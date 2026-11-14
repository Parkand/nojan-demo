import Link from 'next/link';
import { Tags } from '@/components/icons';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import {
  Heading,
  SearchBar,
  Empty,
  Pagination,
  Saved,
} from '@/components/ui';
import {
  fa,
  searchValue,
  pageNumber,
  PAGE_SIZE,
} from '@/lib/utils';
import type { Search } from '@/lib/types';

export const metadata = { title: 'دسته‌بندی‌ها' };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const user = await requireUser();
  const canManageCategories =
    user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  const params = await searchParams;
  const q = searchValue(params.q);
  const page = pageNumber(params.page);

  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
          ],
        }
      : {}),
  };

  const [items, count] = await Promise.all([
    db.category.findMany({
      where,
      include: {
        _count: {
          select: {
            products: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.category.count({ where }),
  ]);

  return (
    <>
      <Heading
        title="دسته‌بندی‌ها"
        subtitle="یک دسته‌بندی ساده برای دسترسی سریع‌تر به کالاها"
        href={canManageCategories ? '/categories/new' : undefined}
        label="ثبت دسته‌بندی"
      />

      <Saved show={params.saved === '1'} />

      <SearchBar
        q={q}
        placeholder="جستجوی کد یا نام دسته‌بندی…"
      />

      <div className="list-caption">
        <span>{fa(count)} دسته‌بندی</span>
        <span>کد و نام</span>
      </div>

      {items.length ? (
        <div className="card-grid">
          {items.map((category) => (
            <article
              className="card catalog-card"
              key={category.id}
            >
              <div className="catalog-icon">
                <Tags size={25} />
              </div>

              <div className="catalog-body">
                <h3>{category.name}</h3>

                <div className="catalog-bottom">
                  <span className="mono muted">
                    {category.code}
                  </span>
                  <span className="badge neutral">
                    {fa(category._count.products)} کالا
                  </span>
                </div>

                {canManageCategories && (
                  <div className="catalog-actions">
                    <Link href={`/categories/${category.id}/edit`}>
                      ویرایش و مدیریت ←
                    </Link>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="دسته‌بندی‌ای برای نمایش نیست"
          description="مدیر می‌تواند دسته‌بندی‌های مورد نیاز را ثبت کند."
        />
      )}

      <Pagination
        page={page}
        count={count}
        path="/categories"
        query={{ q }}
      />
    </>
  );
}