// src/app/(workspace)/tasks/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Role, TaskEventType, TaskPriority, TaskStatus } from '@prisma/client';
import { TaskTransitionForm } from '@/components/task-transition-form';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { canTransitionTask, canViewTask } from '@/lib/task-permissions';
import type { TaskTransition } from '@/lib/task-permissions';
import styles from './task-details.module.css';

export const dynamic = 'force-dynamic';
const HISTORY_PAGE_SIZE = 20;

const statusLabels: Record<TaskStatus, string> = {
  ASSIGNED: 'شروع‌نشده',
  IN_PROGRESS: 'در حال انجام',
  SUBMITTED: 'در انتظار بررسی',
  CHANGES_REQUESTED: 'نیازمند اصلاح',
  APPROVED: 'تأییدشده',
  CANCELLED: 'لغوشده',
};
const priorityLabels: Record<TaskPriority, string> = {
  LOW: 'کم', NORMAL: 'عادی', HIGH: 'زیاد', URGENT: 'فوری',
};
const eventLabels: Record<TaskEventType, string> = {
  CREATED: 'ایجاد وظیفه', UPDATED: 'ویرایش وظیفه',
  REASSIGNED: 'تغییر مسئول وظیفه', STARTED: 'شروع انجام',
  SUBMITTED: 'ارسال برای بررسی', CHANGES_REQUESTED: 'درخواست اصلاح',
  APPROVED: 'تأیید وظیفه', CANCELLED: 'لغو وظیفه',
  COMMENTED: 'ثبت نظر', DELETED: 'حذف وظیفه',
};
const statusClasses: Record<TaskStatus, string> = {
  ASSIGNED: styles.assigned, IN_PROGRESS: styles.progress,
  SUBMITTED: styles.submitted, CHANGES_REQUESTED: styles.changes,
  APPROVED: styles.approved, CANCELLED: styles.cancelled,
};
const transitions: TaskTransition[] = ['START', 'SUBMIT', 'REQUEST_CHANGES', 'APPROVE', 'CANCEL'];
const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian', timeZone: 'Asia/Tehran', year: 'numeric',
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
const numberFormatter = new Intl.NumberFormat('fa-IR', { useGrouping: false });

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

function DateValue({ value }: { value: Date | null }) {
  return value === null ? <>ثبت نشده</> : (
    <time dateTime={value.toISOString()}>{dateFormatter.format(value)}</time>
  );
}

function PersonValue({ person }: { person: { name: string; deletedAt: Date | null } }) {
  return <>{person.name}{person.deletedAt !== null ? ' (حساب حذف‌شده)' : ''}</>;
}

export default async function TaskDetailsPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const route = await params;
  const query = await searchParams;
  const taskId = parseId(route.id);
  if (taskId === null) notFound();
  const before = parseId(query.before);

  const task = await db.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      ...(user.role !== Role.SUPER_ADMIN ? {
        OR: [{ createdById: user.id }, { assigneeId: user.id }, { reviewerId: user.id }],
      } : {}),
    },
    select: {
      id: true, title: true, description: true, status: true, priority: true,
      version: true, deletedAt: true, createdById: true, assigneeId: true,
      reviewerId: true, createdAt: true, updatedAt: true, dueAt: true,
      startedAt: true, submittedAt: true, approvedAt: true, cancelledAt: true,
      createdBy: { select: { name: true, deletedAt: true } },
      assignee: { select: { id: true, role: true, name: true, deletedAt: true } },
      reviewer: { select: { name: true, deletedAt: true } },
      events: {
        where: before !== null ? { id: { lt: before } } : {},
        orderBy: { id: 'desc' },
        take: HISTORY_PAGE_SIZE + 1,
        select: {
          id: true, type: true, createdAt: true, fromStatus: true,
          toStatus: true, message: true,
          actor: { select: { name: true, deletedAt: true } },
        },
      },
    },
  });

  const actor = { id: user.id, role: user.role, deletedAt: null };
  if (task === null || !canViewTask(actor, task)) notFound();

  const allowedTransitions = transitions.filter(transition =>
    canTransitionTask(actor, task, task.assignee, transition),
  );
  const events = task.events.slice(0, HISTORY_PAGE_SIZE);
  const hasOlderEvents = task.events.length > HISTORY_PAGE_SIZE;
  const lastEvent = events[events.length - 1];
  const closed = task.status === TaskStatus.APPROVED || task.status === TaskStatus.CANCELLED;
  const overdue = !closed && task.dueAt !== null && task.dueAt.getTime() < Date.now();
  const timeFields = [
    { label: 'زمان ایجاد', value: task.createdAt },
    { label: 'آخرین به‌روزرسانی', value: task.updatedAt },
    { label: 'شروع انجام', value: task.startedAt },
    { label: 'ارسال برای بررسی', value: task.submittedAt },
    { label: 'تأیید', value: task.approvedAt },
    { label: 'لغو', value: task.cancelledAt },
  ];

  return (
    <section dir="rtl" className={styles.page} aria-labelledby="task-title">
      <nav className={styles.breadcrumb} aria-label="مسیر صفحه">
        <Link href="/tasks" className={styles.backLink}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          <span>فهرست وظایف</span>
        </Link>
        <span aria-hidden="true">/</span>
        <span>وظیفهٔ {numberFormatter.format(task.id)}</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.eyebrow}>جزئیات وظیفه · شمارهٔ {numberFormatter.format(task.id)}</span>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${statusClasses[task.status]}`}>
              <span className={styles.dot} aria-hidden="true" />{statusLabels[task.status]}
            </span>
            <span className={`${styles.badge} ${task.priority === TaskPriority.URGENT ? styles.urgent : styles.priority}`}>
              اولویت {priorityLabels[task.priority]}
            </span>
          </div>
        </div>
        <h1 id="task-title">{task.title}</h1>
        <div className={styles.heroMeta}>
          <span>مسئول: <strong><PersonValue person={task.assignee} /></strong></span>
          <span className={overdue ? styles.overdueText : undefined}>
            مهلت: {task.dueAt ? <DateValue value={task.dueAt} /> : 'بدون مهلت'}
          </span>
        </div>
        {overdue && <p className={styles.warning}>مهلت انجام این وظیفه گذشته است.</p>}
      </header>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.card} aria-labelledby="task-description-heading">
            <div className={styles.sectionHeading}>
              <h2 id="task-description-heading">شرح وظیفه</h2>
            </div>
            <div className={styles.description}>{task.description || 'شرحی برای این وظیفه ثبت نشده است.'}</div>
          </section>

          <section className={`${styles.card} ${styles.operations}`} aria-labelledby="task-operations-heading">
            <div className={styles.sectionHeading}>
              <h2 id="task-operations-heading">عملیات وظیفه</h2>
              <span>متناسب با وضعیت و دسترسی شما</span>
            </div>
            {allowedTransitions.length > 0 ? (
              <TaskTransitionForm
                key={`${task.id}:${task.version}:${allowedTransitions.join(',')}`}
                taskId={task.id}
                version={task.version}
                allowedTransitions={allowedTransitions}
              />
            ) : (
              <p className={styles.empty}>
                {closed ? 'این وظیفه بسته شده است؛ تغییر وضعیت در دسترس نیست.' : 'در وضعیت فعلی، عملیاتی برای شما در دسترس نیست.'}
              </p>
            )}
          </section>
        </div>

        <aside className={styles.infoColumn} aria-label="اطلاعات تکمیلی وظیفه">
          <section className={styles.card} aria-labelledby="task-people-heading">
            <div className={styles.sectionHeading}><h2 id="task-people-heading">افراد مرتبط</h2></div>
            <dl className={styles.people}>
              <div><dt>مسئول انجام</dt><dd><PersonValue person={task.assignee} /></dd></div>
              <div><dt>بررسی‌کننده</dt><dd><PersonValue person={task.reviewer} /></dd></div>
              <div><dt>ایجادکننده</dt><dd><PersonValue person={task.createdBy} /></dd></div>
            </dl>
          </section>

          <section className={styles.card} aria-labelledby="task-deadline-heading">
            <div className={styles.sectionHeading}><h2 id="task-deadline-heading">زمان‌بندی</h2></div>
            <div className={`${styles.deadline} ${overdue ? styles.deadlineOverdue : ''}`}>
              <span>مهلت انجام</span>
              <strong>{task.dueAt ? <DateValue value={task.dueAt} /> : 'بدون مهلت'}</strong>
            </div>
            <details className={styles.timeDetails}>
              <summary>نمایش زمان‌های ثبت‌شده</summary>
              <dl className={styles.timeList}>
                {timeFields.map(field => (
                  <div key={field.label}><dt>{field.label}</dt><dd><DateValue value={field.value} /></dd></div>
                ))}
              </dl>
            </details>
            <p className={styles.timeNote}>تاریخ‌ها شمسی و ساعت‌ها به وقت تهران هستند.</p>
          </section>
        </aside>
      </div>

      <section className={`${styles.card} ${styles.history}`} aria-labelledby="task-history-heading">
        <div className={styles.sectionHeading}>
          <h2 id="task-history-heading">تاریخچهٔ فعالیت‌ها</h2>
          <span>از جدید به قدیم</span>
        </div>
        {before !== null && (
          <p className={styles.historyNotice}>در حال مشاهدهٔ رویدادهای قدیمی‌تر هستید. برای دیدن نتیجهٔ عملیات جدید، «جدیدترین رویدادها» را انتخاب کنید.</p>
        )}
        {events.length === 0 ? (
          <p className={styles.empty} role="status">
            {before !== null ? 'رویداد قدیمی‌تری در این بخش وجود ندارد.' : 'هنوز رویدادی برای این وظیفه ثبت نشده است.'}
          </p>
        ) : (
          <ol className={styles.timeline} aria-label="رویدادهای وظیفه">
            {events.map(event => (
              <li key={event.id}>
                <article aria-labelledby={`event-heading-${event.id}`}>
                  <div className={styles.eventHeading}>
                    <h3 id={`event-heading-${event.id}`}>{eventLabels[event.type]}</h3>
                    <span className={styles.eventDate}><DateValue value={event.createdAt} /></span>
                  </div>
                  <p className={styles.eventActor}>ثبت‌کننده: <PersonValue person={event.actor} /></p>
                  {(event.fromStatus !== null || event.toStatus !== null) && (
                    <div className={styles.eventStatuses}>
                      {event.fromStatus !== null && <span>از: {statusLabels[event.fromStatus]}</span>}
                      {event.fromStatus !== null && event.toStatus !== null && <span aria-hidden="true">←</span>}
                      {event.toStatus !== null && <span>به: {statusLabels[event.toStatus]}</span>}
                    </div>
                  )}
                  {event.message && <div className={styles.eventMessage}>{event.message}</div>}
                </article>
              </li>
            ))}
          </ol>
        )}
        {(before !== null || (hasOlderEvents && lastEvent)) && (
          <nav className={styles.pagination} aria-label="صفحه‌بندی تاریخچه">
            {before !== null && <Link href={`/tasks/${task.id}#task-history-heading`} className={styles.secondaryButton}>جدیدترین رویدادها</Link>}
            {hasOlderEvents && lastEvent && <Link href={`/tasks/${task.id}?before=${lastEvent.id}#task-history-heading`} className={styles.secondaryButton}>رویدادهای قدیمی‌تر</Link>}
          </nav>
        )}
      </section>
    </section>
  );
}
