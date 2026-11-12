import Link from 'next/link';
import { Package } from '@/components/icons';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Heading,SearchBar,Empty,Pagination,Saved } from '@/components/ui';
import { fa,searchValue,pageNumber,PAGE_SIZE } from '@/lib/utils';
import type { Search } from '@/lib/types';
export const metadata={title:'کالاها'};
export default async function ProductsPage({searchParams}:{searchParams:Search}) {
 const user=await requireUser();const admin=user.role==='ADMIN';const params=await searchParams;
 const q=searchValue(params.q);const page=pageNumber(params.page);const where={deletedAt:null,...(q?{OR:[{name:{contains:q}},{code:{contains:q}},{category:{name:{contains:q}}}]}:{})};
 const [items,count]=await Promise.all([db.product.findMany({where,include:{category:{select:{name:true}}},orderBy:{id:'desc'},skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE}),db.product.count({where})]);
 return <><Heading title="کالاها" subtitle="فهرست کالاها، دسته‌بندی‌ها و واحدهای اندازه‌گیری" href={admin?'/products/new':undefined} label="ثبت کالای جدید"/><Saved show={params.saved==='1'}/><SearchBar q={q} placeholder="جستجوی نام کالا، کد یا دسته‌بندی…"/><div className="list-caption"><span>{fa(count)} کالا</span><span>مرتب‌سازی: جدیدترین</span></div>{items.length?<div className="card-grid">{items.map(p=><article className="card catalog-card" key={p.id}><div className="catalog-icon"><Package size={25}/></div><div className="catalog-body"><h3>{p.name}</h3><div className="catalog-category">{p.category.name}</div><div className="catalog-bottom"><span className="mono muted">{p.code}</span><span className="badge neutral">{p.unit}</span></div>{admin&&<div className="catalog-actions"><Link href={`/products/${p.id}/edit`}>ویرایش و مدیریت کالا ←</Link></div>}</div></article>)}</div>:<Empty title="کالایی برای نمایش نیست" description={q?'عبارت جستجو را تغییر دهید.':'برای ثبت کالا، ابتدا یک دسته‌بندی ایجاد کنید.'}/>}<Pagination page={page} count={count} path="/products" query={{q}}/></>;
}
