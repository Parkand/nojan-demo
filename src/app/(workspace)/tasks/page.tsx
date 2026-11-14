import Link from 'next/link';
import {
  Prisma,
  Role,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

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

const statusValues: TaskStatus[] = [
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.SUBMITTED,
  TaskStatus.CHANGES_REQUESTED,
  TaskStatus.APPROVED,
  TaskStatus.CANCELLED,
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

type Scope = 'all' | 'assigned' | 'created' | 'review';

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function singleValue(
  value: string | string[] | undefined,
): string {
  return typeof value === 'string' ? value : '';
}

function parseStatus(
  value: string | string[] | undefined,
): TaskStatus | null {
  const raw = singleValue(value);

  return statusValues.find(status => status === raw) ?? null;
}

function parseScope(
  value: string | string[] | undefined,
): Scope {
  switch (singleValue(value)) {
    case 'assigned':
      return 'assigned';
    case 'created':
      return 'created';
    case 'review':
      return 'review';
    default:
      return 'all';
  }
}

function parseBefore(
  value: string | string[] | undefined,
): number | null {
  const raw = singleValue(value);

  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  return Number.isSafeInteger(id) && id <= 2147483647
    ? id
    : null;
}

function listUrl(
  scope: Scope,
  status: TaskStatus | null,
  before: number | null = null,
): string {
  const query = new URLSearchParams();

  if (scope !== 'all') {
    query.set('scope', scope);
  }

  if (status !== null) {
    query.set('status', status);
  }

  if (before !== null) {
    query.set('before', String(before));
  }

  const suffix = query.toString();

  return suffix ? `/tasks?${suffix}` : '/tasks';
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const scope = parseScope(params.scope);
  const status = parseStatus(params.status);
  const before = parseBefore(params.before);

  const canCreate =
    user.role === Role.ADMIN ||
    user.role === Role.SUPER_ADMIN;

  const conditions: Prisma.TaskWhereInput[] = [
    { deletedAt: null },
  ];

  if (user.role !== Role.SUPER_ADMIN) {
    conditions.push({
      OR: [
        { createdById: user.id },
        { assigneeId: user.id },
        { reviewerId: user.id },
      ],
    });
  }

  switch (scope) {
    case 'assigned':
      conditions.push({ assigneeId: user.id });
      break;
    case 'created':
      conditions.push({ createdById: user.id });
      break;
    case 'review':
      conditions.push({ reviewerId: user.id });
      break;
  }

  if (status !== null) {
    conditions.push({ status });
  }

  if (before !== null) {
    conditions.push({ id: { lt: before } });
  }

  const rows = await db.task.findMany({
    where: { AND: conditions },
    orderBy: { id: 'desc' },
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      dueAt: true,
      assignee: {
        select: {
          name: true,
          deletedAt: true,
        },
      },
      createdBy: {
        select: {
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
    },
  });

  const tasks = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  const lastTask = tasks[tasks.length - 1];
  const now = Date.now();

  return (
    <section dir="rtl">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1>وظایف</h1>
          <p>
            {user.role === Role.SUPER_ADMIN
              ? 'فهرست وظایف سازمان؛ با امکان محدودکردن نمایش به وظایف مرتبط با شما.'
              : 'وظایفی که ایجادکننده، مسئول یا بررسی‌کنندهٔ آن‌ها هستید.'}
          </p>
        </div>

        {canCreate && (
          <Link href="/tasks/new" className="btn primary">
            ایجاد وظیفه
          </Link>
        )}
      </header>

      <form
        key={`${scope}:${status ?? 'all'}`}
        action="/tasks"
        method="get"
        aria-label="فیلتر وظایف"
        style={{
          display: 'flex',
          alignItems: 'end',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <label className="field">
          <span>ارتباط با من</span>
          <select name="scope" defaultValue={scope}>
            <option value="all">همهٔ وظایف قابل دسترسی</option>
            <option value="assigned">مسئولیت من</option>
            <option value="created">ایجادشده توسط من</option>
            <option value="review">بررسی من</option>
          </select>
        </label>

        <label className="field">
          <span>وضعیت</span>
          <select name="status" defaultValue={status ?? ''}>
            <option value="">همهٔ وضعیت‌ها</option>
            {statusValues.map(value => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn primary">
          اعمال فیلتر
        </button>

        <Link href="/tasks" className="btn secondary">
          پاک‌کردن فیلترها
        </Link>
      </form>

      {tasks.length === 0 ? (
        <div role="status">
          <h2>
            {before !== null
              ? 'وظیفهٔ قدیمی‌تری در این فهرست نیست'
              : 'وظیفه‌ای با این شرایط پیدا نشد'}
          </h2>
          <p>
            {before !== null
              ? 'به جدیدترین وظایف برگردید یا فیلترها را تغییر دهید.'
              : 'می‌توانید فیلترها را تغییر دهید. وظایف قابل دسترسی شما در این بخش نمایش داده می‌شوند.'}
          </p>
        </div>
      ) : (
        <>
          <p>
            تعداد نمایش‌داده‌شده در این صفحه:{' '}
            {numberFormatter.format(tasks.length)}
          </p>

          <ul
            aria-label="فهرست وظایف"
            style={{
              display: 'grid',
              gap: 16,
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {tasks.map(task => {
              const closed =
                task.status === TaskStatus.APPROVED ||
                task.status === TaskStatus.CANCELLED;

              const overdue =
                !closed &&
                task.dueAt !== null &&
                task.dueAt.getTime() < now;

              return (
                <li key={task.id}>
                  <article
                    aria-labelledby={`task-title-${task.id}`}
                    style={{
                      border: '1px solid var(--line, #e5e7eb)',
                      borderRadius: 16,
                      background: 'var(--white, #fff)',
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <h2
                        id={`task-title-${task.id}`}
                        style={{
                          margin: 0,
                          fontSize: '1.1rem',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <Link
                          href={`/tasks/${task.id}`}
                          style={{
                            color: 'inherit',
                            textDecoration: 'underline',
                            textUnderlineOffset: 4,
                          }}
                        >
                          {task.title}
                        </Link>
                      </h2>

                      <span>
                        شناسه: {numberFormatter.format(task.id)}
                      </span>
                    </div>

                    <p>
                      <strong>{statusLabels[task.status]}</strong>
                      {' · '}
                      اولویت: {priorityLabels[task.priority]}
                    </p>

                    <dl
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'max-content minmax(0, 1fr)',
                        gap: '10px 16px',
                      }}
                    >
                      <dt>مسئول</dt>
                      <dd
                        style={{
                          margin: 0,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {task.assignee.name}
                        {task.assignee.deletedAt !== null
                          ? ' (حساب حذف‌شده)'
                          : ''}
                      </dd>

                      <dt>ایجادکننده</dt>
                      <dd
                        style={{
                          margin: 0,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {task.createdBy.name}
                        {task.createdBy.deletedAt !== null
                          ? ' (حساب حذف‌شده)'
                          : ''}
                      </dd>

                      <dt>بررسی‌کننده</dt>
                      <dd
                        style={{
                          margin: 0,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {task.reviewer.name}
                        {task.reviewer.deletedAt !== null
                          ? ' (حساب حذف‌شده)'
                          : ''}
                      </dd>

                      <dt>زمان ایجاد</dt>
                      <dd style={{ margin: 0 }}>
                        <time dateTime={task.createdAt.toISOString()}>
                          {dateFormatter.format(task.createdAt)}
                        </time>
                      </dd>

                      <dt>مهلت</dt>
                      <dd style={{ margin: 0 }}>
                        {task.dueAt ? (
                          <time dateTime={task.dueAt.toISOString()}>
                            {dateFormatter.format(task.dueAt)}
                          </time>
                        ) : (
                          'بدون مهلت'
                        )}

                        {overdue && (
                          <strong
                            style={{
                              display: 'block',
                              color: '#b91c1c',
                              marginTop: 4,
                            }}
                          >
                            مهلت گذشته است
                          </strong>
                        )}
                      </dd>
                    </dl>

                    <footer
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                        marginTop: 16,
                      }}
                    >
                      <small>
                        تمام ساعت‌ها به وقت تهران هستند.
                      </small>

                      <Link
                        href={`/tasks/${task.id}`}
                        className="btn secondary"
                        aria-label={`جزئیات و عملیات وظیفهٔ شمارهٔ ${numberFormatter.format(task.id)}: ${task.title}`}
                      >
                        جزئیات و عملیات
                      </Link>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <nav
        aria-label="صفحه‌بندی وظایف"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 24,
        }}
      >
        {before !== null && (
          <Link
            href={listUrl(scope, status)}
            className="btn secondary"
          >
            بازگشت به جدیدترین وظایف
          </Link>
        )}

        {hasMore && lastTask && (
          <Link
            href={listUrl(scope, status, lastTask.id)}
            className="btn secondary"
          >
            وظایف قدیمی‌تر
          </Link>
        )}
      </nav>
    </section>
  );
}