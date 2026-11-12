import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Back,Heading,Status,Audit,Saved } from '@/components/ui';
import { ActionForm } from '@/components/forms';
import { fa,dateFa,timeFa } from '@/lib/utils';
import type { Search } from '@/lib/types';
export const metadata={title:'جزئیات سفارش'};
export default async function OrderDetail({params,searchParams}:{params:Promise<{id:string}>,searchParams:Search}) {
 const user=await requireUser();const id=Number((await params).id);
 if(!Number.isSafeInteger(id)||id<1||id>2147483647)notFound();
 const order=await db.order.findFirst({where:{id,deletedAt:null,...(user.role==='ADMIN'?{}:{userId:user.id})},include:{user:{select:{name:true}},approvedBy:{select:{name:true}},createdBy:{select:{name:true}},updatedBy:{select:{name:true}},items:{where:{deletedAt:null},orderBy:{id:'asc'},include:{product:{include:{category:{select:{name:true}}}}}}}});
 if(!order)notFound();
 return <><Back href="/orders"/><Heading title="جزئیات سفارش" subtitle="اطلاعات درخواست و اقلام مورد نیاز"/><Saved show={(await searchParams).saved==='1'}/><div className="form-panel"><div className="detail-top"><h2>سفارش #{fa(id)}</h2><Status approved={!!order.approvedAt}/></div><dl className="detail-info"><div><dt>ثبت‌کننده سفارش</dt><dd>{order.user.name}</dd></div><div><dt>تاریخ سفارش</dt><dd>{dateFa(order.orderDate)}</dd></div><div><dt>تعداد اقلام</dt><dd>{fa(order.items.length)} قلم کالا</dd></div></dl><div className="detail-items">{order.items.map(item=><article className="detail-item" key={item.id}><div className="card-top"><h3>{item.product.name}</h3><span className="mono muted">{item.product.code}</span></div><div className="catalog-category">{item.product.category.name}{item.product.deletedAt&&' · کالای حذف‌شده (سابقه محفوظ است)'}</div><div className="quantities"><div className="quantity"><span>موجودی فعلی اعلام‌شده</span><strong>{fa(item.currentStock.toString())}</strong><small>{item.product.unit}</small></div><div className="quantity required"><span>مقدار مورد نیاز</span><strong>{fa(item.requiredQuantity.toString())}</strong><small>{item.product.unit}</small></div></div></article>)}</div>
 {order.approvedAt?<div className="approval-note">تأیید توسط {order.approvedBy?.name??'مدیر'} در {timeFa(order.approvedAt)}<br/>این سفارش قفل است و قابل ویرایش یا حذف نیست.</div>:<div className="detail-actions">{user.role==='ADMIN'&&<ActionForm action="order.approve" id={id} label="تأیید نهایی سفارش" confirm="پس از تأیید، امکان ویرایش یا حذف این سفارش وجود ندارد. تأیید می‌کنید؟"/>}<Link className="btn secondary" href={`/orders/${id}/edit`}>ویرایش سفارش</Link><ActionForm action="order.delete" id={id} label="حذف سفارش" danger confirm="سفارش و تمام آیتم‌های آن به‌صورت نرم حذف شوند؟"/></div>}
 <Audit item={order}/></div></>;
}
