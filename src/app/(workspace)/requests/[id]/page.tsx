import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PersonnelRequestForm } from '@/components/personnel-request-form';
import { PersonnelRequestNotificationsRead } from '@/components/personnel-request-notifications-read';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  canReceivePersonnelRequest,
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

function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

export default async function PersonnelRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const user = await requireUser();
  const route = await params;
  const query = await searchParams;
  const id = parseId(route.id);
  const before = parseId(query.before);

  if (id === null) {
    notFound();
  }

  const accessWhere = {
    AND: [{ id }, personnelRequestReadWhere(user)],
  };

  const accessibleRequest = await db.personnelRequest.findFirst({
    where: accessWhere,
    select: { id: true },
  });

  if (!accessibleRequest) {
    notFound();
  }

  const unreadNotifications = await db.notification.findMany({
    where: {
      personnelRequestId: id,
      recipientId: user.id,
      readAt: null,
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 100,
  });

  const request = await db.personnelRequest.findFirst({
    where: accessWhere,
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      senderRole: true,
      sender: {
        select: {
          name: true,
          deletedAt: true,
        },
      },
      recipients: {
        orderBy: { id: 'asc' },
        select: {
          recipientId: true,
          readAt: true,
          recipient: { select: { name: true } },
        },
      },
      replies: {
        where: before === null ? {} : { id: { lt: before } },
        orderBy: { id: 'desc' },
        take: PAGE_SIZE + 1,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!request) {
    notFound();
  }

  const own = request.senderId === user.id;

  const ownRecipient = request.recipients.find(
    (recipient) => recipient.recipientId === user.id,
  );

  const eligibleRecipient =
    ownRecipient !== undefined &&
    canReceivePersonnelRequest(request.senderRole, user.role);

  const supervisory =
    user.role === 'SUPER_ADMIN' && !own && !eligibleRecipient;

  const canReply =
    eligibleRecipient &&
    !own &&
    request.sender.deletedAt === null;

  const hasMore = request.replies.length > PAGE_SIZE;
  const replies = request.replies.slice(0, PAGE_SIZE);
  const last = replies[replies.length - 1];

  return (
    <section dir="rtl" style={{ maxWidth: 900 }}>
      <PersonnelRequestNotificationsRead
        key={`${user.id}:${request.id}`}
        requestId={request.id}
        notificationIds={unreadNotifications.map(
          (notification) => notification.id,
        )}
      />

      <Link href="/requests" className="btn secondary">
        بازگشت به درخواست‌ها
      </Link>

      <h1>درخواست شمارهٔ {request.id.toLocaleString('fa-IR')}</h1>
      <p>ارسال‌کننده: {request.sender.name}</p>

      <p>
        <time dateTime={request.createdAt.toISOString()}>
          {dateFormatter.format(request.createdAt)} — ساعت تهران
        </time>
      </p>

      {supervisory && (
        <aside
          aria-label="دسترسی نظارتی"
          style={{
            padding: 16,
            marginBlock: 20,
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--white)',
          }}
        >
          <strong>مشاهدهٔ نظارتی — فقط خواندنی</strong>
          <p>
            این درخواست در محدودهٔ دسترسی نظارتی مدیر ارشد نمایش
            داده می‌شود. شما گیرندهٔ مجاز پاسخ‌گویی به این درخواست
            نیستید و امکان ثبت پاسخ یا ثبت مشاهده به‌جای گیرنده را
            ندارید.
          </p>
        </aside>
      )}

      <article
        aria-label="متن درخواست"
        style={{
          padding: 20,
          border: '1px solid var(--line)',
          borderRadius: 16,
          background: 'var(--white)',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          lineHeight: 2,
        }}
      >
        {request.body}
      </article>

      <section
        aria-label="گیرندگان درخواست"
        style={{ marginBlock: 24 }}
      >
        <h2 style={{ fontSize: '1.1rem' }}>
          {request.recipients.length === 1
            ? 'گیرندهٔ ثبت‌شده هنگام ارسال'
            : 'گیرندگان ثبت‌شده هنگام ارسال'}
        </h2>

        {request.recipients.length === 0 ? (
          <p>گیرنده‌ای ثبت نشده است.</p>
        ) : (
          <ul>
            {request.recipients.map((recipient) => (
              <li key={recipient.recipientId}>
                {recipient.recipient.name}
                {recipient.recipientId === user.id ? ' — شما' : ''}
              </li>
            ))}
          </ul>
        )}

        {request.recipients.length > 1 && (
          <p>
            این درخواست با قاعدهٔ قبلی ارسال شده است؛ گیرندگان
            ثبت‌شدهٔ آن حفظ شده‌اند.
          </p>
        )}
      </section>

      {eligibleRecipient && ownRecipient?.readAt === null && (
        <PersonnelRequestForm
          mode="read"
          requestId={request.id}
        />
      )}

      <h2 style={{ marginTop: 32 }}>پاسخ‌ها</h2>
      <p>جدیدترین پاسخ‌ها ابتدا نمایش داده می‌شوند.</p>

      {replies.length === 0 ? (
        <p>
          {before === null
            ? 'هنوز پاسخی ثبت نشده است.'
            : 'پاسخ قدیمی‌تری وجود ندارد.'}
        </p>
      ) : (
        <ul
          style={{
            display: 'grid',
            gap: 16,
            listStyle: 'none',
            padding: 0,
          }}
        >
          {replies.map((reply) => (
            <li key={reply.id}>
              <article
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 20,
                  background: 'var(--white)',
                }}
              >
                <h3 style={{ marginTop: 0 }}>{reply.author.name}</h3>

                <time dateTime={reply.createdAt.toISOString()}>
                  {dateFormatter.format(reply.createdAt)} — ساعت تهران
                </time>

                <p
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    lineHeight: 2,
                  }}
                >
                  {reply.body}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      <nav
        aria-label="صفحه‌بندی پاسخ‌ها"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBlock: 24,
        }}
      >
        {before !== null && (
          <Link
            href={`/requests/${request.id}`}
            className="btn secondary"
          >
            جدیدترین پاسخ‌ها
          </Link>
        )}

        {hasMore && last && (
          <Link
            href={`/requests/${request.id}?before=${last.id}`}
            className="btn secondary"
          >
            پاسخ‌های قدیمی‌تر
          </Link>
        )}
      </nav>

      {canReply && (
        <section aria-label="ثبت پاسخ جدید">
          <h2>پاسخ به درخواست</h2>
          <PersonnelRequestForm
            mode="reply"
            requestId={request.id}
            submissionKey={randomUUID()}
          />
        </section>
      )}

      {request.sender.deletedAt !== null && (
        <p role="status">
          حساب ارسال‌کننده حذف شده است؛ پاسخ جدید قابل ثبت نیست.
        </p>
      )}
    </section>
  );
}
