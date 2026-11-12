import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { ClipboardList, Clock3, CheckCircle2, UserRound, ChevronLeft } from '@/components/icons';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fa,dateFa,searchValue,pageNumber,PAGE_SIZE,latinDigits } from '@/lib/utils';
import { Heading,SearchBar,Status,Empty,Pagination,Saved } from '@/components/ui';
import type { Search } from '@/lib/types';
export const metadata={title:'سفارش‌ها'};
export default async function OrdersPage({searchParams}:{searchParams:Search}) {
 const user=await requireUser();const params=await searchParams;
 const q=searchValue(params.q);const page=pageNumber(params.page);
 const status=['pending','approved'].includes(searchValue(params.status))?searchValue(params.status):'all';
 const base:Prisma.OrderWhereInput={deletedAt:null,...(user.role==='ADMIN'?{}:{userId:user.id})};
 const number=Number(latinDigits(q.replace('#','')));
 const where:Prisma.OrderWhereInput={...base,...(status==='pending'?{approvedAt:null}:status==='approved'?{approvedAt:{not:null}}:{}),...(q?{OR:[{user:{name:{contains:q}}},...(Number.isSafeInteger(number)&&number>0&&number<2147483648?[{id:number}]:[])]}:{})};
 const [orders,count,total,pending]=await Promise.all([
  db.order.findMany({where,include:{user:{select:{name:true}},_count:{select:{items:{where:{deletedAt:null}}}}},orderBy:{id:'desc'},skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE}),
  db.order.count({where}),db.order.count({where:base}),db.order.count({where:{...base,approvedAt:null}})
 ]);
 return <><Heading title="سفارش‌ها" subtitle={user.role==='ADMIN'?'درخواست‌های کالا را بررسی و تأیید کنید.':'درخواست‌های کالای خود را اینجا مدیریت کنید.'} href="/orders/new" label="ثبت سفارش جدید"/>
 <Saved show={params.saved==='1'}/><div className="stats">{[{value:total,label:'کل سفارش‌ها',icon:ClipboardList},{value:pending,label:'در انتظار تأیید',icon:Clock3},{value:total-pending,label:'تأیید شده',icon:CheckCircle2}].map(({value,label,icon:Icon},i)=><div className={'stat '+(i===1?'highlight':'')} key={label}><div><strong>{fa(value)}</strong><span>{label}</span></div><div className="stat-icon"><Icon size={22}/></div></div>)}</div>
 <SearchBar q={q} placeholder="جستجوی شماره سفارش یا نام کاربر…" hidden={{status}}/>
 <div className="tabs">{[['all','همه سفارش‌ها'],['pending','در انتظار تأیید'],['approved','تأیید شده']].map(([value,label])=><Link className={'tab '+(status===value?'active':'')} key={value} href={'/orders?'+new URLSearchParams({q,status:value})}>{label}</Link>)}</div>
 <div className="list-caption"><span>{fa(count)} سفارش</span><span>جدیدترین سفارش‌ها</span></div>
 {orders.length?<div className="card-grid">{orders.map(order=><article className="card" key={order.id}><div className="card-top"><h3>سفارش #{fa(order.id)}</h3><Status approved={!!order.approvedAt}/></div><div className="card-meta"><span><UserRound size={14}/>{order.user.name}</span><time>{dateFa(order.orderDate)}</time></div><div className="card-footer"><span>{fa(order._count.items)} قلم کالا</span><Link className="card-link" href={`/orders/${order.id}`}>مشاهده جزئیات <ChevronLeft size={15}/></Link></div></article>)}</div>:<Empty title={q?'سفارشی پیدا نشد':'سفارشی برای نمایش نیست'} description="می‌توانید یک سفارش جدید ثبت کنید یا فیلترها را تغییر دهید."/>}
 <Pagination page={page} count={count} path="/orders" query={{q,status}}/></>;
}
