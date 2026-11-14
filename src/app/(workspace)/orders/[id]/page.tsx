import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Back, Heading, Status, Audit, Saved } from '@/components/ui';
import { ActionForm } from '@/components/forms';
import OrderShare from '@/components/order-share';
import { fa, dateFa, timeFa } from '@/lib/utils';
import type { Search } from '@/lib/types';

export const metadata = { title: 'جزئیات سفارش' };

const persianDigits = (value: string) =>
  value.replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

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

  const grouped = whole.toString().replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '٬'
  );

  const fraction = remainder.toString()
    .padStart(3, '0')
    .replace(/0+$/, '');

  return persianDigits(
    fraction ? `${grouped}٫${fraction}` : grouped
  );
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

export default async function OrderDetail({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const user = await requireUser();
  const canManageOrders =
    user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const id = Number((await params).id);

  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    notFound();
  }

  const order = await db.order.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(canManageOrders ? {} : { userId: user.id })
    },
    include: {
      user: { select: { name: true } },
      approvedBy: { select: { name: true } },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
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
    }
  });

  if (!order) notFound();

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

  const missingPriceCount = rows.filter(
    row => row.amount === null
  ).length;

  const pricedCount = rows.length - missingPriceCount;

  const total = rows.reduce(
    (sum, row) => sum + (row.amount ?? BigInt(0)),
    BigInt(0)
  );

  const shareLines: string[] = [
    `نوژان | سفارش ${fa(id)}`,
    `${shortDate(order.orderDate)} | تومان`
  ];

  for (const group of groups) {
    shareLines.push('', `${singleLine(group.name)}:`);

    for (const { item, amount } of group.rows) {
      const productName = singleLine(item.product.name);
      const quantity = fa(item.requiredQuantity.toString());
      const unit = singleLine(item.product.unit);
      const description = `${productName} ${quantity} ${unit}`;

      if (item.unitPrice === null || amount === null) {
        shareLines.push(`${description} | فی نامشخص`);
      } else {
        const unitPrice = money(
          BigInt(item.unitPrice.toFixed(0)) * BigInt(1000)
        );

        shareLines.push(
          `${description} | فی ${unitPrice} | جمع ${money(amount)}`
        );
      }
    }
  }

  shareLines.push('');

  if (rows.length === 0) {
    shareLines.push('بدون قلم');
  } else if (missingPriceCount === 0) {
    shareLines.push(`جمع کل: ${money(total)}`);
  } else {
    shareLines.push(
      pricedCount > 0
        ? `جمع قیمت‌دار: ${money(total)}`
        : 'جمع: نامشخص',
      `${fa(missingPriceCount)} قلم بدون قیمت`
    );
  }

  const shareText = shareLines.join('\n');
  const query = await searchParams;

  return (
    <>
      <Back href="/orders" />

      <Heading
        title="جزئیات سفارش"
        subtitle="مقدار درخواست و هزینه خرید به تومان"
      />

      <Saved show={query.saved === '1'} />

      <div
        className="form-panel"
        style={{ padding: '16px', minWidth: 0 }}
      >
        <div
          className="detail-top"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <h2 style={{ margin: 0 }}>
            سفارش #{fa(id)}
          </h2>

          <Status approved={!!order.approvedAt} />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 16px',
            fontSize: '13px',
            margin: '12px 0',
            lineHeight: 1.9
          }}
        >
          <span>{dateFa(order.orderDate)}</span>
          <span>{fa(order.items.length)} قلم کالا</span>
        </div>

        <section
          aria-label="خلاصه هزینه خرید"
          style={{
            border: '1px solid #e5e7eb',
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '16px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <strong>
              {missingPriceCount > 0
                ? 'جمع اقلام قیمت‌دار'
                : 'جمع هزینه خرید'}
            </strong>

            <strong
              style={{
                fontSize: '20px',
                overflowWrap: 'anywhere'
              }}
            >
              {pricedCount === 0 && rows.length > 0
                ? 'ثبت نشده'
                : `${money(total)} تومان`}
            </strong>
          </div>

          {missingPriceCount > 0 && (
            <p
              role="note"
              style={{
                margin: '8px 0 0',
                fontSize: '13px',
                color: '#92400e',
                lineHeight: 1.9
              }}
            >
              قیمت {fa(missingPriceCount)} قلم ثبت نشده است؛
              مبلغ بالا هزینه کامل سفارش نیست.
            </p>
          )}

          <p
            style={{
              margin: '6px 0 0',
              fontSize: '12px',
              color: '#475569',
              lineHeight: 1.9
            }}
          >
            مبنا: قیمت ثبت‌شده در سفارش × مقدار درخواست.
            تغییر قیمت کالا روی این مبالغ اثر ندارد.
          </p>
        </section>

        {rows.length > 0 && <OrderShare text={shareText} />}

        <section aria-label="اقلام سفارش بر اساس دسته‌بندی">
          {groups.map(group => (
            <section
              key={group.id}
              aria-labelledby={`category-${group.id}`}
              style={{
                marginTop: '16px',
                minWidth: 0
              }}
            >
              <h3
                id={`category-${group.id}`}
                style={{
                  margin: 0,
                  padding: '10px 12px',
                  fontSize: '14px',
                  lineHeight: 1.8,
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  overflowWrap: 'anywhere'
                }}
              >
                {group.name}
              </h3>

              {group.rows.map(({ item, amount }) => (
                <article
                  key={item.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #e5e7eb',
                    minWidth: 0
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      flexWrap: 'wrap',
                      gap: '6px 12px'
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        lineHeight: 1.8,
                        overflowWrap: 'anywhere'
                      }}
                    >
                      {item.product.name}
                    </h4>

                    <strong
                      style={{
                        fontSize: '14px',
                        lineHeight: 1.8,
                        overflowWrap: 'anywhere'
                      }}
                    >
                      {amount === null
                        ? 'هزینه ثبت نشده'
                        : `${money(amount)} تومان`}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px 16px',
                      marginTop: '4px',
                      fontSize: '13px',
                      lineHeight: 1.9
                    }}
                  >
                    <span>
                      درخواست:{' '}
                      <strong>
                        {fa(item.requiredQuantity.toString())}
                      </strong>{' '}
                      {item.product.unit}
                    </span>

                    <span>
                      قیمت هر {item.product.unit}:{' '}
                      {item.unitPrice === null
                        ? 'ثبت نشده'
                        : `${money(
                          BigInt(item.unitPrice.toFixed(0)) *
                          BigInt(1000)
                        )} تومان`}
                    </span>
                  </div>

                  <details
                    style={{
                      marginTop: '4px',
                      fontSize: '12px',
                      lineHeight: 1.9
                    }}
                  >
                    <summary
                      style={{
                        cursor: 'pointer',
                        padding: '8px 0',
                        color: '#475569'
                      }}
                    >
                      اطلاعات بیشتر
                    </summary>

                    <dl
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '8px 12px',
                        margin: '4px 0 8px',
                        padding: '10px',
                        background: '#f8fafc',
                        borderRadius: '8px'
                      }}
                    >
                      <div>
                        <dt>موجودی اعلام‌شده</dt>
                        <dd style={{ margin: 0 }}>
                          {fa(item.currentStock.toString())}{' '}
                          {item.product.unit}
                        </dd>
                      </div>

                      <div>
                        <dt>کد کالا</dt>
                        <dd
                          style={{
                            margin: 0,
                            overflowWrap: 'anywhere'
                          }}
                        >
                          <bdi>{item.product.code}</bdi>
                        </dd>
                      </div>

                      <div>
                        <dt>دسته‌بندی</dt>
                        <dd style={{ margin: 0 }}>
                          {item.product.category.name}
                        </dd>
                      </div>
                    </dl>

                    {item.product.deletedAt && (
                      <p style={{ margin: '4px 0' }}>
                        این کالا حذف شده است؛ سابقه سفارش حفظ شده.
                      </p>
                    )}

                    {item.unitPrice === null && (
                      <p
                        style={{
                          margin: '4px 0',
                          color: '#92400e'
                        }}
                      >
                        قیمت تاریخی این ردیف ثبت نشده است.
                        قیمت فعلی کالا جایگزین آن نمی‌شود.
                      </p>
                    )}
                  </details>
                </article>
              ))}
            </section>
          ))}

          {rows.length === 0 && (
            <p>این سفارش قلم فعالی ندارد.</p>
          )}
        </section>

        {order.approvedAt ? (
          <div className="approval-note">
            تأیید توسط {order.approvedBy?.name ?? 'مدیر'} در{' '}
            {timeFa(order.approvedAt)}
            <br />
            این سفارش قفل است و قابل ویرایش یا حذف نیست.
          </div>
        ) : (
          <div
            className="detail-actions"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '16px'
            }}
          >
            {canManageOrders && (
              <ActionForm
                action="order.approve"
                id={id}
                label="تأیید نهایی سفارش"
                confirm="پس از تأیید، امکان ویرایش یا حذف این سفارش وجود ندارد. تأیید می‌کنید؟"
              />
            )}

            <Link
              className="btn secondary"
              href={`/orders/${id}/edit`}
            >
              ویرایش سفارش
            </Link>

            <ActionForm
              action="order.delete"
              id={id}
              label="حذف سفارش"
              danger
              confirm="سفارش و تمام آیتم‌های آن به‌صورت نرم حذف شوند؟"
            />
          </div>
        )}

        <details
          style={{
            marginTop: '16px',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '8px'
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              padding: '10px 0',
              fontSize: '13px'
            }}
          >
            اطلاعات ثبت و سوابق سفارش
          </summary>

          <p style={{ fontSize: '13px', margin: '8px 0' }}>
            ثبت‌کننده سفارش: {order.user.name}
          </p>

          <Audit item={order} />
        </details>
      </div>
    </>
  );
}