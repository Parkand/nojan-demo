import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  canReceivePersonnelRequest,
  personnelRecipientRoles,
  personnelRequestReadWhere,
} from '@/lib/personnel-request-permissions';
import type { Search } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: 'Asia/Tehran',
  dateStyle: 'medium',
  timeStyle: 'short',
});

function parseBefore(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const before = parseBefore(params.before);
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const rows = await db.personnelRequest.findMany({
    where: {
      AND: [
        personnelRequestReadWhere(user),
        before === null ? {} : { id: { lt: before } },
      ],
    },
    orderBy: { id: 'desc' },
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      senderRole: true,
      sender: { select: { name: true } },
      recipients: {
        orderBy: { id: 'asc' },
        select: {
          recipientId: true,
          readAt: true,
          recipient: { select: { name: true } },
        },
      },
      _count: { select: { replies: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const requests = rows.slice(0, PAGE_SIZE);
  const last = requests[requests.length - 1];

  return (
    <section dir="rtl">
      <h1>درخواست‌های پرسنلی</h1>

      <p>
        {isSuperAdmin
          ? 'تمام درخواست‌ها و پاسخ‌ها برای شما قابل مشاهده است. پاسخ‌دادن فقط برای درخواست‌هایی امکان‌پذیر است که گیرندهٔ مجاز آن‌ها باشید.'
          : 'درخواست‌های ارسال‌شده و درخواست‌هایی که دریافت کرده‌اید.'}
      </p>

      {personnelRecipientRoles(user.role).length > 0 && (
        <Link href="/requests/new" className="btn primary">
          ثبت درخواست جدید
        </Link>
      )}

      {requests.length === 0 ? (
        <p role="status" style={{ marginTop: 24 }}>
          {before === null
            ? 'درخواستی برای نمایش وجود ندارد.'
            : 'درخواست قدیمی‌تری وجود ندارد.'}
        </p>
      ) : (
        <ul
          style={{
            display: 'grid',
            gap: 16,
            listStyle: 'none',
            padding: 0,
            marginTop: 24,
          }}
        >
          {requests.map((request) => {
            const own = request.senderId === user.id;
            const ownRecipient = request.recipients.find(
              (recipient) => recipient.recipientId === user.id,
            );

            const eligibleRecipient =
              ownRecipient !== undefined &&
              canReceivePersonnelRequest(
                request.senderRole,
                user.role,
              );

            const supervisory =
              isSuperAdmin && !own && !eligibleRecipient;

            const unread =
              !own &&
              eligibleRecipient &&
              ownRecipient?.readAt === null;

            const relationship = own
              ? 'ارسال‌شده توسط شما'
              : supervisory
                ? 'مشاهدهٔ نظارتی — فقط خواندنی'
                : 'دریافتی شما';

            return (
              <li key={request.id}>
                <article
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    padding: 20,
                    background: 'var(--white)',
                  }}
                >
                  <h2 style={{ fontSize: '1.1rem' }}>
                    <Link href={`/requests/${request.id}`}>
                      درخواست شمارهٔ {request.id.toLocaleString('fa-IR')}
                    </Link>
                  </h2>

                  <p>
                    <strong>{relationship}</strong>
                    {' — '}
                    {request._count.replies > 0
                      ? 'دارای پاسخ'
                      : 'بدون پاسخ'}
                    {unread ? ' — مشاهده‌نشده' : ''}
                  </p>

                  <p>ارسال‌کننده: {request.sender.name}</p>

                  <p>
                    {request.recipients.length === 1
                      ? 'گیرنده: '
                      : 'گیرندگان ثبت‌شده: '}
                    {request.recipients.length > 0
                      ? request.recipients
                          .map((item) => item.recipient.name)
                          .join('، ')
                      : 'گیرنده‌ای ثبت نشده است.'}
                  </p>

                  <p
                    style={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {request.body.slice(0, 200)}
                    {request.body.length > 200 ? '…' : ''}
                  </p>

                  <p>
                    <time dateTime={request.createdAt.toISOString()}>
                      {dateFormatter.format(request.createdAt)}
                      {' — ساعت تهران'}
                    </time>
                  </p>

                  <Link
                    href={`/requests/${request.id}`}
                    className="btn secondary"
                  >
                    جزئیات و پاسخ‌ها
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <nav
        aria-label="صفحه‌بندی درخواست‌ها"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 24,
        }}
      >
        {before !== null && (
          <Link href="/requests" className="btn secondary">
            جدیدترین درخواست‌ها
          </Link>
        )}

        {hasMore && last && (
          <Link
            href={`/requests?before=${last.id}`}
            className="btn secondary"
          >
            درخواست‌های قدیمی‌تر
          </Link>
        )}
      </nav>
    </section>
  );
}