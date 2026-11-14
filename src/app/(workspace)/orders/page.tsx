import Link from 'next/link';
import { Prisma } from '@prisma/client';
import {
  ClipboardList,
  Clock3,
  CheckCircle2,
  UserRound,
  ChevronLeft
} from '@/components/icons';
import OrderShare from '@/components/order-share';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import {
  fa,
  dateFa,
  searchValue,
  pageNumber,
  PAGE_SIZE,
  latinDigits
} from '@/lib/utils';
import {
  Heading,
  SearchBar,
  Status,
  Empty,
  Pagination,
  Saved
} from '@/components/ui';
import type { Search } from '@/lib/types';

export const metadata = { title: 'سفارش‌ها' };

const shareOrderInclude = {
  user: { select: { name: true } },
  items: {
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
    include: {
      product: {
        include: {
          category: { select: { name: true } }
        }
      }
    }
  }
} satisfies Prisma.OrderInclude;

type ShareOrder = Prisma.OrderGetPayload<{
  include: typeof shareOrderInclude;
}>;

function persianDigits(value: string): string {
  return value.replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function shortDate(value: Date): string {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value);
}

function lineAmount(price: string, quantity: string): bigint {
  const [whole, fraction = ''] = quantity.split('.');
  const quantityThousandths =
    BigInt(whole) * BigInt(1000) +
    BigInt(fraction.padEnd(3, '0'));

  return BigInt(price) * quantityThousandths;
}

function money(amount: bigint): string {
  const whole = amount / BigInt(1000);
  const remainder = amount % BigInt(1000);
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const fraction = remainder.toString().padStart(3, '0').replace(/0+$/, '');

  return persianDigits(fraction ? `${grouped}٫${fraction}` : grouped);
}

function buildShareText(order: ShareOrder): string {
  const collator = new Intl.Collator('fa', {
    numeric: true,
    sensitivity: 'base'
  });

  const rows = order.items.map(item => ({
    item,
    amount: item.unitPrice === null
      ? null
      : lineAmount(
          item.unitPrice.toFixed(0),
          item.requiredQuantity.toFixed(3)
        )
  }));

  type OrderRow = (typeof rows)[number];

  const groupsById = new Map<
    number,
    { id: number; name: string; rows: OrderRow[] }
  >();

  for (const row of rows) {
    const categoryId = row.item.product.categoryId;
    const existing = groupsById.get(categoryId);
    if (existing) {
      existing.rows.push(row);
    } else {
      groupsById.set(categoryId, {
        id: categoryId,
        name: row.item.product.category.name,
        rows: [row]
      });
    }
  }

  const groups = Array.from(groupsById.values()).sort(
    (a, b) => collator.compare(a.name, b.name) || a.id - b.id
  );

  for (const group of groups) {
    group.rows.sort(
      (a, b) =>
        collator.compare(a.item.product.name, b.item.product.name) ||
        a.item.id - b.item.id
    );
  }

  const missingPriceCount = rows.filter(row => row.amount === null).length;
  const pricedCount = rows.length - missingPriceCount;
  const total = rows.reduce(
    (sum, row) => sum + (row.amount ?? BigInt(0)),
    BigInt(0)
  );

  const lines: string[] = [
    `نوژان | سفارش ${fa(order.id)}`,
    `${shortDate(order.orderDate)} | تومان`
  ];

  for (const group of groups) {
    lines.push('', `${singleLine(group.name)}:`);
    for (const { item, amount } of group.rows) {
      const description = [
        singleLine(item.product.name),
        fa(item.requiredQuantity.toString()),
        singleLine(item.product.unit)
      ].join(' ');

      if (item.unitPrice === null || amount === null) {
        lines.push(`${description} | فی نامشخص`);
      } else {
        const unitPrice = money(
          BigInt(item.unitPrice.toFixed(0)) * BigInt(1000)
        );
        lines.push(
          `${description} | فی ${unitPrice} | جمع ${money(amount)}`
        );
      }
    }
  }

  lines.push('');
  if (rows.length === 0) {
    lines.push('بدون قلم');
  } else if (missingPriceCount === 0) {
    lines.push(`جمع کل: ${money(total)}`);
  } else {
    lines.push(
      pricedCount > 0 ? `جمع قیمت‌دار: ${money(total)}` : 'جمع: نامشخص',
      `${fa(missingPriceCount)} قلم بدون قیمت`
    );
  }
  return lines.join('\n');
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Search;
}) {
  const user = await requireUser();
  const canManageOrders =
    user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  const params = await searchParams;
  const q = searchValue(params.q);
  const page = pageNumber(params.page);
  const requestedStatus = searchValue(params.status);
  const status = ['pending', 'approved'].includes(requestedStatus)
    ? requestedStatus
    : 'all';

  const base: Prisma.OrderWhereInput = {
    deletedAt: null,
    ...(canManageOrders ? {} : { userId: user.id })
  };

  const number = Number(latinDigits(q.replace('#', '')));
  const where: Prisma.OrderWhereInput = {
    ...base,
    ...(status === 'pending'
      ? { approvedAt: null }
      : status === 'approved'
        ? { approvedAt: { not: null } }
        : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q } } },
            ...(Number.isSafeInteger(number) &&
            number > 0 &&
            number < 2147483648
              ? [{ id: number }]
              : [])
          ]
        }
      : {})
  };

  const [orders, count, total, pending] = await Promise.all([
    db.order.findMany({
      where,
      include: shareOrderInclude,
      orderBy: { id: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    db.order.count({ where }),
    db.order.count({ where: base }),
    db.order.count({ where: { ...base, approvedAt: null } })
  ]);

  const stats = [
    { value: total, label: 'کل سفارش‌ها', icon: ClipboardList },
    { value: pending, label: 'در انتظار تأیید', icon: Clock3 },
    { value: total - pending, label: 'تأیید شده', icon: CheckCircle2 }
  ];

  const tabs = [
    ['all', 'همه سفارش‌ها'],
    ['pending', 'در انتظار تأیید'],
    ['approved', 'تأیید شده']
  ];

  return (
    <>
      <Heading
        title="سفارش‌ها"
        subtitle={
          canManageOrders
            ? 'درخواست‌های کالا را بررسی و تأیید کنید.'
            : 'درخواست‌های کالای خود را اینجا مدیریت کنید.'
        }
        href="/orders/new"
        label="ثبت سفارش جدید"
      />

      <Saved show={params.saved === '1'} />

      <div className="stats">
        {stats.map(({ value, label, icon: Icon }, index) => (
          <div className={'stat ' + (index === 1 ? 'highlight' : '')} key={label}>
            <div>
              <strong>{fa(value)}</strong>
              <span>{label}</span>
            </div>
            <div className="stat-icon">
              <Icon size={22} />
            </div>
          </div>
        ))}
      </div>

      <SearchBar
        q={q}
        placeholder="جستجوی شماره سفارش یا نام کاربر…"
        hidden={{ status }}
      />

      <div className="tabs">
        {tabs.map(([value, label]) => (
          <Link
            className={'tab ' + (status === value ? 'active' : '')}
            key={value}
            href={'/orders?' + new URLSearchParams({ q, status: value })}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="list-caption">
        <span>{fa(count)} سفارش</span>
        <span>جدیدترین سفارش‌ها</span>
      </div>

      {orders.length ? (
        <div className="card-grid">
          {orders.map(order => (
            <article className="card" key={order.id}>
              <div className="card-top">
                <h3>سفارش #{fa(order.id)}</h3>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <OrderShare text={buildShareText(order)} compact />
                  <Status approved={!!order.approvedAt} />
                </div>
              </div>

              <div className="card-meta">
                <span>
                  <UserRound size={14} />
                  {order.user.name}
                </span>
                <time>{dateFa(order.orderDate)}</time>
              </div>

              <div className="card-footer">
                <span>{fa(order.items.length)} قلم کالا</span>
                <Link className="card-link" href={`/orders/${order.id}`}>
                  مشاهده جزئیات
                  <ChevronLeft size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={q ? 'سفارشی پیدا نشد' : 'سفارشی برای نمایش نیست'}
          description="می‌توانید یک سفارش جدید ثبت کنید یا فیلترها را تغییر دهید."
        />
      )}

      <Pagination
        page={page}
        count={count}
        path="/orders"
        query={{ q, status }}
      />
    </>
  );
}