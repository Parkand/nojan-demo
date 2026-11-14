import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import {
  ReadAllNotificationsButton,
  ReadNotificationButton,
} from '@/components/notification-controls';
import { Empty, Heading } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Search } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const numberFormatter = new Intl.NumberFormat('fa-IR');

function singleValue(
  value: string | string[] | undefined,
): string {
  return typeof value === 'string' ? value : '';
}

function parseBefore(
  value: string | string[] | undefined,
): number | null {
  const raw = singleValue(value);

  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    return null;
  }

  return id;
}

function listUrl(
  unreadOnly: boolean,
  before: number | null = null,
): string {
  const query = new URLSearchParams();

  if (unreadOnly) {
    query.set('filter', 'unread');
  }

  if (before !== null) {
    query.set('before', String(before));
  }

  const suffix = query.toString();

  return suffix
    ? `/notifications?${suffix}`
    : '/notifications';
}

function notificationTarget(notification: {
  personnelRequestId: number | null;
  taskId: number | null;
}): { href: string; label: string } | null {
  if (notification.personnelRequestId !== null) {
    return {
      href: `/requests/${notification.personnelRequestId}`,
      label: 'مشاهدهٔ درخواست و پاسخ‌ها',
    };
  }

  if (notification.taskId !== null) {
    return {
      href: `/tasks/${notification.taskId}`,
      label: 'مشاهدهٔ وظیفه',
    };
  }

  return null;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const unreadOnly = singleValue(params.filter) === 'unread';
  const before = parseBefore(params.before);

  const where: Prisma.NotificationWhereInput = {
    recipientId: user.id,
  };

  if (unreadOnly) {
    where.readAt = null;
  }

  if (before !== null) {
    where.id = { lt: before };
  }

  const [unreadCount, rows] = await db.$transaction([
    db.notification.count({
      where: {
        recipientId: user.id,
        readAt: null,
      },
    }),
    db.notification.findMany({
      where,
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        readAt: true,
        taskId: true,
        personnelRequestId: true,
      },
    }),
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  const notifications = rows.slice(0, PAGE_SIZE);
  const lastNotification =
    notifications[notifications.length - 1];

  return (
    <section dir="rtl">
      <Heading
        title="اعلان‌ها"
        subtitle="اعلان‌های مربوط به حساب کاربری شما"
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <p role="status" aria-live="polite">
          اعلان‌های خوانده‌نشده:{' '}
          <strong>
            {numberFormatter.format(unreadCount)}
          </strong>
        </p>

        <ReadAllNotificationsButton
          disabled={unreadCount === 0}
        />
      </div>

      <nav
        aria-label="فیلتر اعلان‌ها"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Link
          href={listUrl(false)}
          className={`btn ${unreadOnly ? 'secondary' : 'primary'}`}
          aria-current={!unreadOnly ? 'page' : undefined}
        >
          همه
        </Link>

        <Link
          href={listUrl(true)}
          className={`btn ${unreadOnly ? 'primary' : 'secondary'}`}
          aria-current={unreadOnly ? 'page' : undefined}
        >
          خوانده‌نشده
        </Link>
      </nav>

      {notifications.length === 0 ? (
        <Empty
          title={
            before !== null
              ? 'اعلان قدیمی‌تری در این فهرست نیست'
              : unreadOnly
                ? 'اعلان خوانده‌نشده‌ای ندارید'
                : 'هنوز اعلانی دریافت نکرده‌اید'
          }
          description={
            before !== null
              ? 'برای مشاهدهٔ اعلان‌های جدید به ابتدای فهرست برگردید.'
              : 'اعلان‌های مربوط به فعالیت‌های شما در این بخش نمایش داده می‌شوند.'
          }
        />
      ) : (
        <ul
          aria-label="فهرست اعلان‌ها"
          style={{
            display: 'grid',
            gap: 16,
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {notifications.map((notification) => {
            const unread = notification.readAt === null;
            const target = notificationTarget(notification);

            return (
              <li key={notification.id}>
                <article
                  aria-labelledby={`notification-title-${notification.id}`}
                  style={{
                    background: 'var(--white)',
                    border: '1px solid var(--line)',
                    borderInlineStart: unread
                      ? '4px solid var(--red)'
                      : '4px solid var(--line)',
                    borderRadius: 16,
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
                      id={`notification-title-${notification.id}`}
                      style={{
                        margin: 0,
                        fontSize: '1.05rem',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {notification.title}
                    </h2>

                    <span
                      className={`badge ${unread ? 'pending' : 'success'}`}
                    >
                      {unread ? 'خوانده‌نشده' : 'خوانده‌شده'}
                    </span>
                  </div>

                  <p
                    style={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      lineHeight: 2,
                    }}
                  >
                    {notification.body}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <time
                      dateTime={notification.createdAt.toISOString()}
                      style={{
                        color: 'var(--muted)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {dateFormatter.format(notification.createdAt)}
                      {' — ساعت تهران'}
                    </time>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      {target && (
                        <Link
                          href={target.href}
                          className="btn secondary"
                        >
                          {target.label}
                        </Link>
                      )}

                      {unread && (
                        <ReadNotificationButton
                          notificationId={notification.id}
                        />
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <nav
        aria-label="صفحه‌بندی اعلان‌ها"
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
            href={listUrl(unreadOnly)}
            className="btn secondary"
          >
            بازگشت به جدیدترین اعلان‌ها
          </Link>
        )}

        {hasMore && lastNotification && (
          <Link
            href={listUrl(unreadOnly, lastNotification.id)}
            className="btn secondary"
          >
            اعلان‌های قدیمی‌تر
          </Link>
        )}
      </nav>
    </section>
  );
}