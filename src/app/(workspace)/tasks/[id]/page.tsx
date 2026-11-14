import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Role,
  TaskEventType,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { TaskTransitionForm } from '@/components/task-transition-form';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  canTransitionTask,
  canViewTask,
} from '@/lib/task-permissions';
import type { TaskTransition } from '@/lib/task-permissions';

export const dynamic = 'force-dynamic';

const HISTORY_PAGE_SIZE = 20;

const statusLabels: Record<TaskStatus, string> = {
  ASSIGNED: 'تخصیص‌یافته',
  IN_PROGRESS: 'در حال انجام',
  SUBMITTED: 'ارسال‌شده برای بررسی',
  CHANGES_REQUESTED: 'نیازمند اصلاح',
  APPROVED: 'تأییدشده',
  CANCELLED: 'لغوشده',
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: 'کم',
  NORMAL: 'عادی',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

const eventLabels: Record<TaskEventType, string> = {
  CREATED: 'ایجاد وظیفه',
  UPDATED: 'ویرایش وظیفه',
  REASSIGNED: 'تغییر مسئول وظیفه',
  STARTED: 'شروع انجام',
  SUBMITTED: 'ارسال برای بررسی',
  CHANGES_REQUESTED: 'درخواست اصلاح',
  APPROVED: 'تأیید وظیفه',
  CANCELLED: 'لغو وظیفه',
  COMMENTED: 'ثبت نظر',
  DELETED: 'حذف وظیفه',
};

const transitions: TaskTransition[] = [
  'START',
  'SUBMIT',
  'REQUEST_CHANGES',
  'APPROVE',
  'CANCEL',
];

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const numberFormatter = new Intl.NumberFormat('fa-IR', {
  useGrouping: false,
});

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

function parseId(
  value: string | string[] | undefined,
): number | null {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id <= 2147483647
    ? id
    : null;
}

function DateValue({ value }: { value: Date | null }) {
  if (value === null) {
    return <>ثبت نشده</>;
  }

  return (
    <time dateTime={value.toISOString()}>
      {dateFormatter.format(value)}
    </time>
  );
}

function PersonValue({
  person,
}: {
  person: {
    name: string;
    deletedAt: Date | null;
  };
}) {
  return (
    <>
      {person.name}
      {person.deletedAt !== null ? ' (حساب حذف‌شده)' : ''}
    </>
  );
}

export default async function TaskDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const user = await requireUser();
  const route = await params;
  const query = await searchParams;

  const taskId = parseId(route.id);

  if (taskId === null) {
    notFound();
  }

  const before = parseId(query.before);

  const task = await db.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      ...(user.role !== Role.SUPER_ADMIN
        ? {
            OR: [
              { createdById: user.id },
              { assigneeId: user.id },
              { reviewerId: user.id },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      version: true,
      deletedAt: true,
      createdById: true,
      assigneeId: true,
      reviewerId: true,
      createdAt: true,
      updatedAt: true,
      dueAt: true,
      startedAt: true,
      submittedAt: true,
      approvedAt: true,
      cancelledAt: true,
      createdBy: {
        select: {
          name: true,
          deletedAt: true,
        },
      },
      assignee: {
        select: {
          id: true,
          role: true,
          name: true,
          deletedAt: true,
        },
      },
      reviewer: {
        select: {
          name: true,
          deletedAt: true,
        },
      },
      events: {
        where: before !== null
          ? { id: { lt: before } }
          : {},
        orderBy: { id: 'desc' },
        take: HISTORY_PAGE_SIZE + 1,
        select: {
          id: true,
          type: true,
          createdAt: true,
          fromStatus: true,
          toStatus: true,
          message: true,
          actor: {
            select: {
              name: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  const actor = {
    id: user.id,
    role: user.role,
    deletedAt: null,
  };

  if (task === null || !canViewTask(actor, task)) {
    notFound();
  }

  const allowedTransitions = transitions.filter(transition =>
    canTransitionTask(actor, task, task.assignee, transition),
  );

  const events = task.events.slice(0, HISTORY_PAGE_SIZE);
  const hasOlderEvents =
    task.events.length > HISTORY_PAGE_SIZE;
  const lastEvent = events[events.length - 1];

  const closed =
    task.status === TaskStatus.APPROVED ||
    task.status === TaskStatus.CANCELLED;

  const overdue =
    !closed &&
    task.dueAt !== null &&
    task.dueAt.getTime() < Date.now();

  const timeFields = [
    { label: 'زمان ایجاد', value: task.createdAt },
    { label: 'آخرین به‌روزرسانی', value: task.updatedAt },
    { label: 'شروع انجام', value: task.startedAt },
    { label: 'ارسال برای بررسی', value: task.submittedAt },
    { label: 'تأیید', value: task.approvedAt },
    { label: 'لغو', value: task.cancelledAt },
  ];

  return (
    <section dir="rtl" style={{ maxWidth: 1000 }}>
      <nav
        aria-label="مسیر صفحه"
        style={{ marginBottom: 20 }}
      >
        <Link href="/tasks" className="btn secondary">
          بازگشت به فهرست وظایف
        </Link>
      </nav>

      <header style={{ marginBottom: 24 }}>
        <p>
          وظیفهٔ شمارهٔ {numberFormatter.format(task.id)}
        </p>

        <h1 style={{ overflowWrap: 'anywhere' }}>
          {task.title}
        </h1>

        <p>
          <strong>{statusLabels[task.status]}</strong>
          {' · '}
          اولویت: {priorityLabels[task.priority]}
        </p>

        {overdue && (
          <p style={{ color: '#b91c1c' }}>
            مهلت این وظیفه گذشته است.
          </p>
        )}

        <small>
          همهٔ تاریخ‌ها شمسی و ساعت‌ها به وقت تهران هستند.
        </small>
      </header>

      <section
        aria-labelledby="task-description-heading"
        style={{ marginBottom: 28 }}
      >
        <h2 id="task-description-heading">شرح وظیفه</h2>

        <div
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 2,
          }}
        >
          {task.description}
        </div>
      </section>

      <section
        aria-labelledby="task-information-heading"
        style={{ marginBottom: 28 }}
      >
        <h2 id="task-information-heading">
          افراد مرتبط و زمان‌ها
        </h2>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'max-content minmax(0, 1fr)',
            gap: '12px 16px',
          }}
        >
          <dt>ایجادکننده</dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
            <PersonValue person={task.createdBy} />
          </dd>

          <dt>مسئول</dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
            <PersonValue person={task.assignee} />
          </dd>

          <dt>بررسی‌کننده</dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
            <PersonValue person={task.reviewer} />
          </dd>

          <dt>مهلت انجام</dt>
          <dd style={{ margin: 0 }}>
            {task.dueAt ? (
              <DateValue value={task.dueAt} />
            ) : (
              'بدون مهلت'
            )}
          </dd>
        </dl>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'max-content minmax(0, 1fr)',
            gap: '12px 16px',
          }}
        >
          {timeFields.map(field => (
            <div
              key={field.label}
              style={{ display: 'contents' }}
            >
              <dt>{field.label}</dt>
              <dd style={{ margin: 0 }}>
                <DateValue value={field.value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="task-operations-heading"
        style={{
          marginBottom: 28,
          border: '1px solid var(--line, #e5e7eb)',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 id="task-operations-heading">عملیات وظیفه</h2>

        {allowedTransitions.length > 0 ? (
          <TaskTransitionForm
            key={`${task.id}:${task.version}:${allowedTransitions.join(',')}`}
            taskId={task.id}
            version={task.version}
            allowedTransitions={allowedTransitions}
          />
        ) : (
          <p>
            {closed
              ? 'این وظیفه بسته شده است؛ تغییر وضعیت در دسترس نیست.'
              : 'در وضعیت فعلی، عملیاتی برای شما در دسترس نیست.'}
          </p>
        )}
      </section>

      <section aria-labelledby="task-history-heading">
        <h2 id="task-history-heading">تاریخچهٔ وظیفه</h2>
        <p>رویدادها از جدید به قدیم نمایش داده می‌شوند.</p>

        {before !== null && (
          <p>
            در حال مشاهدهٔ بخش قدیمی‌تر تاریخچه هستید. برای
            دیدن نتیجهٔ عملیات جدید، «جدیدترین رویدادها» را
            انتخاب کنید.
          </p>
        )}

        {events.length === 0 ? (
          <p role="status">
            {before !== null
              ? 'رویداد قدیمی‌تری در این بخش وجود ندارد.'
              : 'هنوز رویدادی برای این وظیفه ثبت نشده است.'}
          </p>
        ) : (
          <ol
            aria-label="رویدادهای وظیفه"
            style={{
              listStyle: 'none',
              padding: 0,
              display: 'grid',
              gap: 16,
            }}
          >
            {events.map(event => (
              <li key={event.id}>
                <article
                  aria-labelledby={`event-heading-${event.id}`}
                  style={{
                    border: '1px solid var(--line, #e5e7eb)',
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <h3
                    id={`event-heading-${event.id}`}
                    style={{ marginTop: 0 }}
                  >
                    {eventLabels[event.type]}
                  </h3>

                  <p style={{ overflowWrap: 'anywhere' }}>
                    ثبت‌کننده:{' '}
                    <PersonValue person={event.actor} />
                  </p>

                  <p>
                    <DateValue value={event.createdAt} />
                  </p>

                  {(event.fromStatus !== null ||
                    event.toStatus !== null) && (
                    <p>
                      {event.fromStatus !== null && (
                        <>
                          وضعیت قبلی:{' '}
                          {statusLabels[event.fromStatus]}
                        </>
                      )}

                      {event.fromStatus !== null &&
                        event.toStatus !== null && <br />}

                      {event.toStatus !== null && (
                        <>
                          وضعیت جدید:{' '}
                          {statusLabels[event.toStatus]}
                        </>
                      )}
                    </p>
                  )}

                  {event.message && (
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        lineHeight: 2,
                      }}
                    >
                      {event.message}
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ol>
        )}

        <nav
          aria-label="صفحه‌بندی تاریخچه"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 20,
          }}
        >
          {before !== null && (
            <Link
              href={`/tasks/${task.id}#task-history-heading`}
              className="btn secondary"
            >
              جدیدترین رویدادها
            </Link>
          )}

          {hasOlderEvents && lastEvent && (
            <Link
              href={`/tasks/${task.id}?before=${lastEvent.id}#task-history-heading`}
              className="btn secondary"
            >
              رویدادهای قدیمی‌تر
            </Link>
          )}
        </nav>
      </section>
    </section>
  );
}