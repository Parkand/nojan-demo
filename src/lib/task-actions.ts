'use server';

import {
  NotificationType,
  Prisma,
  TaskEventType,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireUser } from './auth';
import { db } from './db';
import { canCreateTask } from './task-permissions';
import type { ActionState } from './types';

class TaskInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskInputError';
  }
}

type CreateTaskInput = {
  title: string;
  description: string;
  assigneeId: number;
  priority: TaskPriority;
  dueAt: Date | null;
};

function text(formData: FormData, key: string): string {
  const entries = formData.getAll(key);

  if (entries.length === 0) {
    return '';
  }

  if (entries.length !== 1 || typeof entries[0] !== 'string') {
    throw new TaskInputError('ساختار اطلاعات ارسالی معتبر نیست.');
  }

  return entries[0].trim();
}

function positiveId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new TaskInputError('مسئول وظیفه را به‌درستی انتخاب کنید.');
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new TaskInputError('شناسهٔ مسئول وظیفه معتبر نیست.');
  }

  return id;
}

function parsePriority(value: string): TaskPriority {
  switch (value) {
    case '':
    case TaskPriority.NORMAL:
      return TaskPriority.NORMAL;
    case TaskPriority.LOW:
      return TaskPriority.LOW;
    case TaskPriority.HIGH:
      return TaskPriority.HIGH;
    case TaskPriority.URGENT:
      return TaskPriority.URGENT;
    default:
      throw new TaskInputError('اولویت انتخاب‌شده معتبر نیست.');
  }
}

function parseDueAt(value: string): Date | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new TaskInputError('قالب مهلت وظیفه معتبر نیست.');
  }

  const date = new Date(value);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== value ||
    date.getUTCFullYear() < 1000
  ) {
    throw new TaskInputError('تاریخ مهلت وظیفه معتبر نیست.');
  }

  return date;
}

function parseInput(formData: FormData): CreateTaskInput {
  const title = text(formData, 'title');
  const description = text(formData, 'description');

  if (title.length < 3 || title.length > 200) {
    throw new TaskInputError('عنوان وظیفه باید بین ۳ تا ۲۰۰ نویسه باشد.');
  }

  if (description.length < 1 || description.length > 10000) {
    throw new TaskInputError('شرح وظیفه باید بین ۱ تا ۱۰٬۰۰۰ نویسه باشد.');
  }

  return {
    title,
    description,
    assigneeId: positiveId(text(formData, 'assigneeId')),
    priority: parsePriority(text(formData, 'priority')),
    dueAt: parseDueAt(text(formData, 'dueAt')),
  };
}

function actionError(error: unknown): ActionState {
  if (error instanceof TaskInputError) {
    return { error: error.message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') {
      return {
        error: 'اطلاعات هم‌زمان تغییر کرده‌اند. دوباره تلاش کنید.',
      };
    }

    console.error('Task creation failed:', error.code);

    return {
      error: 'ثبت وظیفه انجام نشد. لطفاً دوباره تلاش کنید.',
    };
  }

  console.error(
    'Task creation failed:',
    error instanceof Error ? error.name : 'UnknownError',
  );

  return {
    error: 'ثبت وظیفه انجام نشد. لطفاً دوباره تلاش کنید.',
  };
}

export async function createTask(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionUser = await requireUser();

  try {
    const input = parseInput(formData);

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
          throw new TaskInputError(
            'نشست شما معتبر نیست. دوباره وارد حساب کاربری شوید.',
          );
        }

        const assignee = await tx.user.findUnique({
          where: { id: input.assigneeId },
          select: {
            id: true,
            role: true,
            deletedAt: true,
          },
        });

        if (!assignee || !canCreateTask(actor, assignee, actor)) {
          throw new TaskInputError(
            'اجازهٔ تخصیص وظیفه به این کاربر را ندارید.',
          );
        }

        const now = new Date();

        if (input.dueAt && input.dueAt.getTime() <= now.getTime()) {
          throw new TaskInputError(
            'مهلت وظیفه باید بعد از زمان فعلی باشد.',
          );
        }

        const task = await tx.task.create({
          data: {
            title: input.title,
            description: input.description,
            priority: input.priority,
            dueAt: input.dueAt,
            status: TaskStatus.ASSIGNED,
            createdById: actor.id,
            updatedById: actor.id,
            assigneeId: assignee.id,
            reviewerId: actor.id,
          },
          select: {
            id: true,
            title: true,
          },
        });

        await tx.taskEvent.create({
          data: {
            taskId: task.id,
            actorId: actor.id,
            type: TaskEventType.CREATED,
            toStatus: TaskStatus.ASSIGNED,
            message: 'وظیفه ایجاد و به مسئول تخصیص داده شد.',
            details: {
              assigneeId: assignee.id,
              reviewerId: actor.id,
              priority: input.priority,
              dueAt: input.dueAt?.toISOString() ?? null,
            },
          },
        });

        await tx.notification.create({
          data: {
            recipientId: assignee.id,
            taskId: task.id,
            type: NotificationType.TASK_ASSIGNED,
            title: 'وظیفهٔ جدید',
            body: `وظیفهٔ «${task.title}» به شما تخصیص داده شد.`,
            dedupeKey: `task:${task.id}:created:recipient:${assignee.id}`,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    return actionError(error);
  }

  revalidatePath('/tasks');

  return {};
}