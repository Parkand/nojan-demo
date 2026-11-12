import { notFound,redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Back,Heading,Empty } from '@/components/ui';
import { OrderForm } from '@/components/forms';
export const metadata={title:'ویرایش سفارش'};
export default async function EditOrder({params}:{params:Promise<{id:string}>}) {
 const user=await requireUser();const id=Number((await params).id);
 if(!Number.isSafeInteger(id)||id<1||id>2147483647)notFound();
 const order=await db.order.findFirst({where:{id,deletedAt:null,...(user.role==='ADMIN'?{}:{userId:user.id})},include:{items:{where:{deletedAt:null},orderBy:{id:'asc'}}}});
 if(!order)notFound();if(order.approvedAt)redirect(`/orders/${id}`);
 const products=await db.product.findMany({where:{deletedAt:null,category:{deletedAt:null}},include:{category:{select:{name:true}}},orderBy:{name:'asc'}});
 return <><Back href={`/orders/${id}`} label="بازگشت به جزئیات"/><Heading title="ویرایش سفارش" subtitle="تغییرات تا پیش از تأیید مدیر امکان‌پذیر است."/>{products.length?<div className="form-panel"><OrderForm id={id} date={order.orderDate.toISOString().slice(0,10)} products={products.map(p=>({id:p.id,name:p.name,code:p.code,unit:p.unit,categoryName:p.category.name}))} initialItems={order.items.map(i=>({productId:String(i.productId),currentStock:i.currentStock.toString(),requiredQuantity:i.requiredQuantity.toString()}))}/></div>:<Empty title="کالای فعالی برای ویرایش سفارش وجود ندارد" description="ابتدا از مدیر بخواهید کالاهای مورد نیاز را ثبت کند."/>}</>;
}
