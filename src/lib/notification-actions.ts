'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireUser } from './auth';
import { db } from './db';
import type { ActionState } from './types';

class NotificationActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationActionError';
  }
}

type SessionIdentity = {
  id: number;
  sessionVersion: number;
};

function notificationIdFrom(formData: FormData): number {
  const values = formData.getAll('notificationId');

  if (values.length !== 1 || typeof values[0] !== 'string') {
    throw new NotificationActionError('شناسهٔ اعلان معتبر نیست.');
  }

  const value = values[0].trim();

  if (!/^[1-9]\d*$/.test(value)) {
    throw new NotificationActionError('شناسهٔ اعلان معتبر نیست.');
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new NotificationActionError('شناسهٔ اعلان معتبر نیست.');
  }

  return id;
}

async function assertActiveSession(
  tx: Prisma.TransactionClient,
  session: SessionIdentity,
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: session.id },
    select: {
      deletedAt: true,
      sessionVersion: true,
    },
  });

  if (
    !user ||
    user.deletedAt !== null ||
    user.sessionVersion !== session.sessionVersion
  ) {
    throw new NotificationActionError(
      'نشست شما معتبر نیست. دوباره وارد حساب کاربری شوید.',
    );
  }
}

function errorState(error: unknown): ActionState {
  if (error instanceof NotificationActionError) {
    return { error: error.message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') {
      return {
        error: 'اطلاعات هم‌زمان تغییر کرده‌اند. دوباره تلاش کنید.',
      };
    }

    console.error('Notification update failed:', error.code);

    return {
      error: 'وضعیت اعلان‌ها تغییر نکرد. لطفاً دوباره تلاش کنید.',
    };
  }

  console.error(
    'Notification update failed:',
    error instanceof Error ? error.name : 'UnknownError',
  );

  return {
    error: 'وضعیت اعلان‌ها تغییر نکرد. لطفاً دوباره تلاش کنید.',
  };
}

export async function markNotificationRead(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionUser = await requireUser();

  try {
    const notificationId = notificationIdFrom(formData);

    await db.$transaction(
      async (tx) => {
        await assertActiveSession(tx, sessionUser);

        const notification = await tx.notification.findFirst({
          where: {
            id: notificationId,
            recipientId: sessionUser.id,
          },
          select: {
            id: true,
            readAt: true,
          },
        });

        if (!notification) {
          throw new NotificationActionError(
            'اعلان موردنظر در دسترس شما نیست.',
          );
        }

        if (notification.readAt !== null) {
          return;
        }

        await tx.notification.updateMany({
          where: {
            id: notification.id,
            recipientId: sessionUser.id,
            readAt: null,
          },
          data: {
            readAt: new Date(),
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return errorState(error);
  }

  revalidatePath('/(workspace)', 'layout');

  return {};
}

export async function markAllNotificationsRead(
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const sessionUser = await requireUser();
  const cutoff = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        await assertActiveSession(tx, sessionUser);

        await tx.notification.updateMany({
          where: {
            recipientId: sessionUser.id,
            readAt: null,
            createdAt: {
              lte: cutoff,
            },
          },
          data: {
            readAt: cutoff,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return errorState(error);
  }

  revalidatePath('/(workspace)', 'layout');

  return {};
}