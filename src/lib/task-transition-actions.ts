'use server';

import {
  NotificationType,
  Prisma,
  TaskEventType,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireUser } from './auth';
import { db } from './db';
import {
  canTransitionTask,
  getTaskTransitionStatus,
} from './task-permissions';
import type { TaskTransition } from './task-permissions';
import type { ActionState } from './types';

class TaskTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskTransitionError';
  }
}

type TransitionInput = {
  taskId: number;
  version: number;
  transition: TaskTransition;
  message: string;
};

type TransitionMetadata = {
  eventType: TaskEventType;
  notificationType: NotificationType;
  title: string;
  defaultMessage: string;
};

function readText(formData: FormData, key: string): string {
  const values = formData.getAll(key);

  if (values.length === 0) {
    return '';
  }

  if (values.length !== 1 || typeof values[0] !== 'string') {
    throw new TaskTransitionError(
      'ساختار اطلاعات ارسالی معتبر نیست.',
    );
  }

  return values[0].trim();
}

function readInteger(
  value: string,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new TaskTransitionError(`${label} معتبر نیست.`);
  }

  const result = Number(value);

  if (
    !Number.isSafeInteger(result) ||
    result < minimum ||
    result > maximum
  ) {
    throw new TaskTransitionError(`${label} معتبر نیست.`);
  }

  return result;
}

function parseTransition(value: string): TaskTransition {
  switch (value) {
    case 'START':
    case 'SUBMIT':
    case 'REQUEST_CHANGES':
    case 'APPROVE':
    case 'CANCEL':
      return value;
    default:
      throw new TaskTransitionError(
        'عملیات انتخاب‌شده معتبر نیست.',
      );
  }
}

function parseInput(formData: FormData): TransitionInput {
  const taskId = readInteger(
    readText(formData, 'taskId'),
    1,
    2147483647,
    'شناسهٔ وظیفه',
  );

  const version = readInteger(
    readText(formData, 'version'),
    0,
    2147483646,
    'نسخهٔ وظیفه',
  );

  const transition = parseTransition(
    readText(formData, 'transition'),
  );

  const message = readText(formData, 'message');

  if (message.length > 5000) {
    throw new TaskTransitionError(
      'توضیحات نباید بیشتر از ۵٬۰۰۰ نویسه باشد.',
    );
  }

  const requiresMessage =
    transition === 'SUBMIT' ||
    transition === 'REQUEST_CHANGES' ||
    transition === 'CANCEL';

  if (requiresMessage && message.length < 3) {
    throw new TaskTransitionError(
      'برای این عملیات توضیحی با حداقل ۳ نویسه وارد کنید.',
    );
  }

  return {
    taskId,
    version,
    transition,
    message,
  };
}

function metadataFor(
  transition: TaskTransition,
): TransitionMetadata {
  switch (transition) {
    case 'START':
      return {
        eventType: TaskEventType.STARTED,
        notificationType: NotificationType.TASK_UPDATED,
        title: 'شروع انجام وظیفه',
        defaultMessage: 'مسئول وظیفه انجام کار را شروع کرد.',
      };

    case 'SUBMIT':
      return {
        eventType: TaskEventType.SUBMITTED,
        notificationType: NotificationType.TASK_SUBMITTED,
        title: 'وظیفه منتظر بررسی است',
        defaultMessage: 'نتیجهٔ وظیفه برای بررسی ارسال شد.',
      };

    case 'REQUEST_CHANGES':
      return {
        eventType: TaskEventType.CHANGES_REQUESTED,
        notificationType: NotificationType.TASK_CHANGES_REQUESTED,
        title: 'وظیفه نیاز به اصلاح دارد',
        defaultMessage: 'وظیفه برای اصلاح برگشت داده شد.',
      };

    case 'APPROVE':
      return {
        eventType: TaskEventType.APPROVED,
        notificationType: NotificationType.TASK_APPROVED,
        title: 'وظیفه تأیید شد',
        defaultMessage: 'نتیجهٔ وظیفه توسط بررسی‌کننده تأیید شد.',
      };

    case 'CANCEL':
      return {
        eventType: TaskEventType.CANCELLED,
        notificationType: NotificationType.TASK_CANCELLED,
        title: 'وظیفه لغو شد',
        defaultMessage: 'وظیفه لغو شد.',
      };

    default:
      throw new TaskTransitionError(
        'عملیات انتخاب‌شده معتبر نیست.',
      );
  }
}

function errorState(error: unknown): ActionState {
  if (error instanceof TaskTransitionError) {
    return { error: error.message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') {
      return {
        error:
          'اطلاعات هم‌زمان تغییر کرده‌اند. صفحه را تازه‌سازی کرده و دوباره تلاش کنید.',
      };
    }

    console.error('Task transition failed:', error.code);

    return {
      error: 'تغییر وضعیت ثبت نشد. لطفاً دوباره تلاش کنید.',
    };
  }

  console.error(
    'Task transition failed:',
    error instanceof Error ? error.name : 'UnknownError',
  );

  return {
    error: 'تغییر وضعیت ثبت نشد. لطفاً دوباره تلاش کنید.',
  };
}

export async function transitionTask(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionUser = await requireUser();

  try {
    const input = parseInput(formData);
    const metadata = metadataFor(input.transition);

    await db.$transaction(
      async (tx) => {
        const actor = await tx.user.findUnique({
          where: { id: sessionUser.id },
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
          actor.sessionVersion !== sessionUser.sessionVersion
        ) {
          throw new TaskTransitionError(
            'نشست شما معتبر نیست. دوباره وارد حساب کاربری شوید.',
          );
        }

        const task = await tx.task.findUnique({
          where: { id: input.taskId },
          select: {
            id: true,
            title: true,
            createdById: true,
            assigneeId: true,
            reviewerId: true,
            status: true,
            version: true,
            deletedAt: true,
            startedAt: true,
            assignee: {
              select: {
                id: true,
                role: true,
                deletedAt: true,
              },
            },
          },
        });

        if (
          !task ||
          !canTransitionTask(
            actor,
            task,
            task.assignee,
            input.transition,
          )
        ) {
          throw new TaskTransitionError(
            'این عملیات برای وظیفهٔ انتخاب‌شده در دسترس شما نیست.',
          );
        }

        if (task.version !== input.version) {
          throw new TaskTransitionError(
            'این وظیفه تغییر کرده است. ابتدا صفحه را تازه‌سازی کنید.',
          );
        }

        const now = new Date();
        const nextStatus = getTaskTransitionStatus(input.transition);
        const nextVersion = task.version + 1;

        const data: Prisma.TaskUncheckedUpdateManyInput = {
          status: nextStatus,
          version: { increment: 1 },
          updatedById: actor.id,
        };

        switch (input.transition) {
          case 'START':
            data.startedAt = task.startedAt ?? now;
            data.submittedAt = null;
            data.approvedAt = null;
            break;

          case 'SUBMIT':
            data.submittedAt = now;
            data.approvedAt = null;
            break;

          case 'REQUEST_CHANGES':
            data.submittedAt = null;
            data.approvedAt = null;
            break;

          case 'APPROVE':
            data.approvedAt = now;
            break;

          case 'CANCEL':
            data.cancelledAt = now;
            break;
        }

        const result = await tx.task.updateMany({
          where: {
            id: task.id,
            version: input.version,
            status: task.status,
            deletedAt: null,
          },
          data,
        });

        if (result.count !== 1) {
          throw new TaskTransitionError(
            'این وظیفه هم‌زمان تغییر کرده است. صفحه را تازه‌سازی کنید.',
          );
        }

        await tx.taskEvent.create({
          data: {
            taskId: task.id,
            actorId: actor.id,
            type: metadata.eventType,
            fromStatus: task.status,
            toStatus: nextStatus,
            message: input.message || metadata.defaultMessage,
            details: {
              previousVersion: task.version,
              version: nextVersion,
            },
          },
        });

        const recipientIds = Array.from(
          new Set([
            task.createdById,
            task.assigneeId,
            task.reviewerId,
          ]),
        ).filter((id) => id !== actor.id);

        const recipients = await tx.user.findMany({
          where: {
            id: { in: recipientIds },
            deletedAt: null,
          },
          select: { id: true },
        });

        if (recipients.length > 0) {
          await tx.notification.createMany({
            data: recipients.map((recipient) => ({
              recipientId: recipient.id,
              taskId: task.id,
              type: metadata.notificationType,
              title: metadata.title,
              body: `${metadata.defaultMessage} عنوان وظیفه: «${task.title}»`,
              dedupeKey:
                `task:${task.id}:version:${nextVersion}` +
                `:recipient:${recipient.id}`,
            })),
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return errorState(error);
  }

  revalidatePath('/tasks');

  return {};
}