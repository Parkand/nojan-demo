import Link from 'next/link';
import { UserRound, ShieldCheck } from '@/components/icons';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { Heading,SearchBar,Empty,Pagination,Saved } from '@/components/ui';
import { fa,searchValue,pageNumber,PAGE_SIZE } from '@/lib/utils';
import type { Search } from '@/lib/types';
export const metadata={title:'کاربران'};
export default async function UsersPage({searchParams}:{searchParams:Search}) {
 await requireAdmin();const params=await searchParams;const q=searchValue(params.q);const page=pageNumber(params.page);const where={deletedAt:null,...(q?{OR:[{name:{contains:q}},{username:{contains:q}}]}:{})};
 const [items,count]=await Promise.all([db.user.findMany({where,select:{id:true,name:true,username:true,role:true},orderBy:{id:'desc'},skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE}),db.user.count({where})]);
 return <><Heading title="کاربران" subtitle="مدیریت حساب‌های کاربری و سطح دسترسی" href="/users/new" label="ثبت کاربر جدید"/><Saved show={params.saved==='1'}/><SearchBar q={q} placeholder="جستجوی نام یا نام کاربری…"/><div className="list-caption"><span>{fa(count)} کاربر فعال</span><span>دسترسی ویژه مدیر</span></div>{items.length?<div className="card-grid">{items.map(u=><article className="card catalog-card" key={u.id}><div className="catalog-icon">{u.role==='ADMIN'?<ShieldCheck size={25}/>:<UserRound size={25}/>}</div><div className="catalog-body"><h3>{u.name}</h3><div className="catalog-bottom"><span className="mono muted">{u.username}</span><span className={'badge '+(u.role==='ADMIN'?'pending':'neutral')}>{u.role==='ADMIN'?'مدیر':'کاربر'}</span></div><div className="catalog-actions"><Link href={`/users/${u.id}/edit`}>ویرایش و مدیریت حساب ←</Link></div></div></article>)}</div>:<Empty title="کاربری پیدا نشد" description="عبارت جستجو را تغییر دهید."/>}<Pagination page={page} count={count} path="/users" query={{q}}/></>;
}
