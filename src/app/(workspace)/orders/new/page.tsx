import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Heading,Back,Empty } from '@/components/ui';
import { OrderForm } from '@/components/forms';
import { today } from '@/lib/utils';
export const metadata={title:'ثبت سفارش'};
export default async function NewOrder(){
 const user=await requireUser();
 const products=await db.product.findMany({where:{deletedAt:null,category:{deletedAt:null}},include:{category:{select:{name:true}}},orderBy:{name:'asc'}});
 return <><Back href="/orders"/><Heading title="ثبت سفارش جدید" subtitle={`ثبت‌کننده: ${user.name} · کالاها و مقادیر مورد نیاز را وارد کنید.`}/>{products.length?<div className="form-panel"><OrderForm date={today()} products={products.map(p=>({id:p.id,name:p.name,code:p.code,unit:p.unit,categoryName:p.category.name}))}/></div>:<Empty title="هنوز کالای فعالی وجود ندارد" description="مدیر ابتدا باید دسته‌بندی و کالاها را ثبت کند."/>}</>;
}
