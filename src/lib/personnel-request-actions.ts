'use server';

import { NotificationType, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireUser } from './auth';
import { db } from './db';
import {
  canReceivePersonnelRequest,
  personnelRecipientRoles,
  personnelRequestReadWhere,
} from './personnel-request-permissions';
import type { ActionState } from './types';

class PersonnelRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonnelRequestError';
  }
}

type SessionIdentity = {
  id: number;
  sessionVersion: number;
};

function readField(formData: FormData, name: string): string {
  const values = formData.getAll(name);

  if (values.length !== 1 || typeof values[0] !== 'string') {
    throw new PersonnelRequestError(
      'ساختار اطلاعات ارسالی معتبر نیست.',
    );
  }

  return values[0].trim();
}

function readBody(formData: FormData): string {
  const body = readField(formData, 'body');

  if (body.length < 3 || body.length > 5000) {
    throw new PersonnelRequestError(
      'متن باید بین ۳ تا ۵٬۰۰۰ نویسه باشد.',
    );
  }

  return body;
}

function readSubmissionKey(formData: FormData): string {
  const value = readField(formData, 'submissionKey');

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new PersonnelRequestError(
      'شناسهٔ ارسال معتبر نیست. صفحه را تازه‌سازی کنید.',
    );
  }

  return value.toLowerCase();
}

function readPositiveId(
  formData: FormData,
  name: string,
  errorMessage: string,
): number {
  const raw = readField(formData, name);

  if (!/^[1-9]\d*$/.test(raw)) {
    throw new PersonnelRequestError(errorMessage);
  }

  const id = Number(raw);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new PersonnelRequestError(errorMessage);
  }

  return id;
}

function readRequestId(formData: FormData): number {
  return readPositiveId(
    formData,
    'requestId',
    'شناسهٔ درخواست معتبر نیست.',
  );
}

function readRecipientId(formData: FormData): number {
  return readPositiveId(
    formData,
    'recipientId',
    'یک گیرندهٔ معتبر انتخاب کنید.',
  );
}

async function requireTransactionActor(
  tx: Prisma.TransactionClient,
  session: SessionIdentity,
) {
  const actor = await tx.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      role: true,
      deletedAt: true,
      sessionVersion: true,
    },
  });

  if (
    !actor ||
    actor.deletedAt !== null ||
    actor.sessionVersion !== session.sessionVersion
  ) {
    throw new PersonnelRequestError(
      'نشست شما معتبر نیست. دوباره وارد حساب کاربری شوید.',
    );
  }

  return actor;
}

function failure(error: unknown): ActionState {
  if (error instanceof PersonnelRequestError) {
    return { error: error.message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034' || error.code === 'P2002') {
      return {
        error:
          'عملیات هم‌زمان شناسایی شد. دوباره تلاش کنید؛ ارسال ثبت‌شده تکرار نمی‌شود.',
      };
    }

    console.error('Personnel request operation failed:', error.code);
  } else {
    console.error(
      'Personnel request operation failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
  }

  return {
    error: 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.',
  };
}

function refreshPaths(requestId: number): void {
  revalidatePath('/requests');
  revalidatePath(`/requests/${requestId}`);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}

async function markRelatedNotificationsRead(
  tx: Prisma.TransactionClient,
  requestId: number,
  recipientId: number,
  notificationIds?: number[],
): Promise<number> {
  if (notificationIds?.length === 0) {
    return 0;
  }

  const result = await tx.notification.updateMany({
    where: {
      personnelRequestId: requestId,
      recipientId,
      readAt: null,
      ...(notificationIds === undefined
        ? {}
        : { id: { in: notificationIds } }),
    },
    data: { readAt: new Date() },
  });

  return result.count;
}

/**
 * فقط اعلان‌هایی خوانده می‌شوند که هنگام تولید این صفحه وجود داشتند.
 * اعلان تازه‌ای که پس از آن ایجاد شود، ناخواسته خوانده نمی‌شود.
 * این عملیات وضعیت مشاهدهٔ گیرنده را تغییر نمی‌دهد.
 */
export async function markPersonnelRequestNotificationsRead(
  requestId: number,
  notificationIds: number[],
): Promise<ActionState> {
  const session = await requireUser();
  let changed = 0;

  try {
    if (
      !Number.isSafeInteger(requestId) ||
      requestId <= 0 ||
      requestId > 2147483647 ||
      !Array.isArray(notificationIds) ||
      notificationIds.length > 100 ||
      notificationIds.some(
        (id) =>
          !Number.isSafeInteger(id) ||
          id <= 0 ||
          id > 2147483647,
      )
    ) {
      throw new PersonnelRequestError(
        'اطلاعات اعلان‌های درخواست معتبر نیست.',
      );
    }

    changed = await db.$transaction(
      async (tx) => {
        const actor = await requireTransactionActor(tx, session);

        const request = await tx.personnelRequest.findFirst({
          where: {
            AND: [{ id: requestId }, personnelRequestReadWhere(actor)],
          },
          select: { id: true },
        });

        if (!request) {
          throw new PersonnelRequestError(
            'درخواست در دسترس شما نیست.',
          );
        }

        return markRelatedNotificationsRead(
          tx,
          request.id,
          actor.id,
          [...new Set(notificationIds)],
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return failure(error);
  }

  if (changed > 0) {
    refreshPaths(requestId);
  }

  return {};
}

export async function createPersonnelRequest(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  let requestId: number;

  try {
    const body = readBody(formData);
    const submissionKey = readSubmissionKey(formData);
    const recipientId = readRecipientId(formData);

    requestId = await db.$transaction(
      async (tx) => {
        const actor = await requireTransactionActor(tx, session);
        const roles = personnelRecipientRoles(actor.role);

        if (roles.length === 0) {
          throw new PersonnelRequestError(
            'ثبت درخواست در این بخش برای نقش شما فعال نیست.',
          );
        }

        const existing = await tx.personnelRequest.findUnique({
          where: { submissionKey },
          select: {
            id: true,
            senderId: true,
            body: true,
            recipients: {
              select: { recipientId: true },
            },
          },
        });

        if (existing) {
          const sameRecipient =
            existing.recipients.length === 1 &&
            existing.recipients[0]?.recipientId === recipientId;

          if (
            existing.senderId !== actor.id ||
            existing.body !== body ||
            !sameRecipient
          ) {
            throw new PersonnelRequestError(
              'شناسهٔ ارسال قابل استفاده نیست. برای درخواست جدید صفحه را تازه‌سازی کنید.',
            );
          }

          return existing.id;
        }

        const recipient = await tx.user.findFirst({
          where: {
            id: recipientId,
            role: { in: roles },
            deletedAt: null,
            NOT: { id: actor.id },
          },
          select: { id: true },
        });

        if (!recipient) {
          throw new PersonnelRequestError(
            'گیرندهٔ انتخاب‌شده در دسترس نیست یا اجازهٔ ارسال درخواست به او را ندارید. صفحه را تازه‌سازی و دوباره انتخاب کنید.',
          );
        }

        const request = await tx.personnelRequest.create({
          data: {
            senderId: actor.id,
            senderRole: actor.role,
            body,
            submissionKey,
          },
          select: { id: true },
        });

        await tx.personnelRequestRecipient.create({
          data: {
            requestId: request.id,
            recipientId: recipient.id,
          },
        });

        await tx.notification.create({
          data: {
            recipientId: recipient.id,
            personnelRequestId: request.id,
            type: NotificationType.PERSONNEL_REQUEST_CREATED,
            title: 'درخواست پرسنلی جدید',
            body: 'یک درخواست جدید برای شما ثبت شده است. برای مشاهده وارد بخش درخواست‌ها شوید.',
            dedupeKey:
              `personnel:${request.id}:created:recipient:${recipient.id}`,
          },
        });

        return request.id;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return failure(error);
  }

  refreshPaths(requestId);
  return {};
}

export async function replyToPersonnelRequest(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  let requestId: number;

  try {
    requestId = readRequestId(formData);
    const body = readBody(formData);
    const submissionKey = readSubmissionKey(formData);

    await db.$transaction(
      async (tx) => {
        const actor = await requireTransactionActor(tx, session);

        const request = await tx.personnelRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            senderId: true,
            senderRole: true,
            sender: {
              select: { deletedAt: true },
            },
            recipients: {
              where: { recipientId: actor.id },
              select: { id: true },
            },
          },
        });

        if (
          !request ||
          request.senderId === actor.id ||
          request.recipients.length === 0 ||
          !canReceivePersonnelRequest(request.senderRole, actor.role)
        ) {
          throw new PersonnelRequestError(
            'درخواست در دسترس نیست یا اجازهٔ پاسخ‌دادن ندارید.',
          );
        }

        const existing = await tx.personnelRequestReply.findUnique({
          where: { submissionKey },
          select: {
            requestId: true,
            authorId: true,
            body: true,
          },
        });

        if (existing) {
          if (
            existing.requestId !== request.id ||
            existing.authorId !== actor.id ||
            existing.body !== body
          ) {
            throw new PersonnelRequestError(
              'شناسهٔ ارسال قابل استفاده نیست. برای پاسخ جدید صفحه را تازه‌سازی کنید.',
            );
          }

          await markRelatedNotificationsRead(
            tx,
            request.id,
            actor.id,
          );

          return;
        }

        if (request.sender.deletedAt !== null) {
          throw new PersonnelRequestError(
            'حساب ارسال‌کننده حذف شده است و پاسخ جدید ثبت نمی‌شود.',
          );
        }

        const reply = await tx.personnelRequestReply.create({
          data: {
            requestId: request.id,
            authorId: actor.id,
            body,
            submissionKey,
          },
          select: { id: true },
        });

        await tx.personnelRequestRecipient.updateMany({
          where: {
            requestId: request.id,
            recipientId: actor.id,
            readAt: null,
          },
          data: { readAt: new Date() },
        });

        await markRelatedNotificationsRead(
          tx,
          request.id,
          actor.id,
        );

        await tx.notification.create({
          data: {
            recipientId: request.senderId,
            personnelRequestId: request.id,
            type: NotificationType.PERSONNEL_REQUEST_REPLIED,
            title: 'پاسخ درخواست پرسنلی',
            body: 'برای درخواست شما پاسخ ثبت شده است. برای مشاهده وارد بخش درخواست‌ها شوید.',
            dedupeKey:
              `personnel:${request.id}:reply:${reply.id}` +
              `:recipient:${request.senderId}`,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return failure(error);
  }

  refreshPaths(requestId);
  return {};
}

export async function markPersonnelRequestRead(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  let requestId: number;

  try {
    requestId = readRequestId(formData);

    await db.$transaction(
      async (tx) => {
        const actor = await requireTransactionActor(tx, session);

        const request = await tx.personnelRequest.findUnique({
          where: { id: requestId },
          select: {
            senderRole: true,
            recipients: {
              where: { recipientId: actor.id },
              select: { id: true },
            },
          },
        });

        if (
          !request ||
          request.recipients.length === 0 ||
          !canReceivePersonnelRequest(request.senderRole, actor.role)
        ) {
          throw new PersonnelRequestError(
            'درخواست در دسترس شما نیست.',
          );
        }

        await tx.personnelRequestRecipient.updateMany({
          where: {
            requestId,
            recipientId: actor.id,
            readAt: null,
          },
          data: { readAt: new Date() },
        });

        await markRelatedNotificationsRead(tx, requestId, actor.id);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return failure(error);
  }

  refreshPaths(requestId);
  return {};
}