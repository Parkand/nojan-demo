import { Role, TaskStatus } from '@prisma/client';

export type TaskActor = {
  id: number;
  role: Role;
  deletedAt: Date | null;
};

export type TaskAccessRecord = {
  createdById: number;
  assigneeId: number;
  reviewerId: number;
  status: TaskStatus;
  deletedAt: Date | null;
};

export type TaskTransition =
  | 'START'
  | 'SUBMIT'
  | 'REQUEST_CHANGES'
  | 'APPROVE'
  | 'CANCEL';

function isActive(actor: TaskActor): boolean {
  return actor.deletedAt === null;
}

function isManager(actor: TaskActor): boolean {
  return (
    isActive(actor) &&
    (actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN)
  );
}

function isOpen(task: TaskAccessRecord): boolean {
  return (
    task.deletedAt === null &&
    task.status !== TaskStatus.APPROVED &&
    task.status !== TaskStatus.CANCELLED
  );
}

export function canAssignTask(
  actor: TaskActor,
  assignee: TaskActor,
): boolean {
  if (!isActive(actor) || !isActive(assignee)) {
    return false;
  }

  if (actor.id === assignee.id) {
    return false;
  }

  if (actor.role === Role.SUPER_ADMIN) {
    return assignee.role === Role.ADMIN || assignee.role === Role.USER;
  }

  return actor.role === Role.ADMIN && assignee.role === Role.USER;
}

export function canCreateTask(
  creator: TaskActor,
  assignee: TaskActor,
  reviewer: TaskActor,
): boolean {
  return (
    canAssignTask(creator, assignee) &&
    canAssignTask(reviewer, assignee)
  );
}

export function canViewTask(
  actor: TaskActor,
  task: TaskAccessRecord,
): boolean {
  if (!isActive(actor) || task.deletedAt !== null) {
    return false;
  }

  return (
    actor.role === Role.SUPER_ADMIN ||
    actor.id === task.createdById ||
    actor.id === task.assigneeId ||
    actor.id === task.reviewerId
  );
}

export function canEditTask(
  actor: TaskActor,
  task: TaskAccessRecord,
  assignee: TaskActor,
): boolean {
  if (!isOpen(task) || task.status === TaskStatus.SUBMITTED) {
    return false;
  }

  if (assignee.id !== task.assigneeId) {
    return false;
  }

  if (!canAssignTask(actor, assignee)) {
    return false;
  }

  return (
    actor.role === Role.SUPER_ADMIN ||
    actor.id === task.createdById
  );
}

export function canCommentOnTask(
  actor: TaskActor,
  task: TaskAccessRecord,
): boolean {
  return isOpen(task) && canViewTask(actor, task);
}

export function canTransitionTask(
  actor: TaskActor,
  task: TaskAccessRecord,
  assignee: TaskActor,
  transition: TaskTransition,
): boolean {
  if (!isActive(actor) || !isOpen(task)) {
    return false;
  }

  if (assignee.id !== task.assigneeId) {
    return false;
  }

  switch (transition) {
    case 'START':
      return (
        actor.id === task.assigneeId &&
        (task.status === TaskStatus.ASSIGNED ||
          task.status === TaskStatus.CHANGES_REQUESTED)
      );

    case 'SUBMIT':
      return (
        actor.id === task.assigneeId &&
        task.status === TaskStatus.IN_PROGRESS
      );

    case 'REQUEST_CHANGES':
    case 'APPROVE':
      return (
        task.status === TaskStatus.SUBMITTED &&
        actor.id === task.reviewerId &&
        actor.id !== task.assigneeId &&
        canAssignTask(actor, assignee)
      );

    case 'CANCEL':
      return (
        isManager(actor) &&
        actor.id !== task.assigneeId &&
        (
          actor.role === Role.SUPER_ADMIN ||
          (
            actor.id === task.createdById &&
            canAssignTask(actor, assignee)
          )
        )
      );

    default:
      return false;
  }
}

export function getTaskTransitionStatus(
  transition: TaskTransition,
): TaskStatus {
  switch (transition) {
    case 'START':
      return TaskStatus.IN_PROGRESS;
    case 'SUBMIT':
      return TaskStatus.SUBMITTED;
    case 'REQUEST_CHANGES':
      return TaskStatus.CHANGES_REQUESTED;
    case 'APPROVE':
      return TaskStatus.APPROVED;
    case 'CANCEL':
      return TaskStatus.CANCELLED;
    default:
      throw new Error('عملیات تغییر وضعیت وظیفه معتبر نیست.');
  }
}