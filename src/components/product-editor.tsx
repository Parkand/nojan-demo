import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { Back,Heading,Audit,Empty } from './ui';
import { ActionForm } from './forms';
export async function ProductEditor({id}:{id?:number}) {
 await requireAdmin();
 const item=id?await db.product.findFirst({where:{id,deletedAt:null},include:{createdBy:{select:{name:true}},updatedBy:{select:{name:true}}}}):null;
 if(id&&!item)notFound();
 const categories=await db.category.findMany({where:{deletedAt:null},orderBy:{name:'asc'}});
 return <><Back href="/products"/><Heading title={item?'ویرایش کالا':'ثبت کالای جدید'} subtitle="کد کالا یکتا است و پس از حذف هم رزرو می‌ماند."/>{categories.length?<div className="form-panel"><ActionForm action="product.save" id={item?.id}><div className="form-grid"><label className="field">کد کالا<input name="code" defaultValue={item?.code} required maxLength={40} dir="ltr" placeholder="PR-001"/></label><label className="field">نام کالا<input name="name" defaultValue={item?.name} required minLength={2} maxLength={160} placeholder="مثلاً کاغذ A4"/></label><label className="field">دسته‌بندی<select name="categoryId" defaultValue={item?.categoryId??''} required><option value="">انتخاب دسته‌بندی…</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}</select></label><label className="field">واحد<input name="unit" defaultValue={item?.unit} required maxLength={30} placeholder="عدد، بسته، کیلوگرم…"/></label></div></ActionForm>{item&&<Audit item={item}/>}</div>:<Empty title="ابتدا یک دسته‌بندی ثبت کنید" description="برای هر کالا انتخاب دسته‌بندی الزامی است."/>}{item&&<div className="delete-section"><p>حذف کالا، سوابق سفارش‌های قبلی را از بین نمی‌برد.</p><ActionForm action="product.delete" id={item.id} label="حذف کالا" danger confirm="این کالا از فهرست فعال حذف شود؟"/></div>}</>;
}
