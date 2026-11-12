import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { Back,Heading,Audit } from './ui';
import { ActionForm } from './forms';
export async function CategoryEditor({id}:{id?:number}) {
 await requireAdmin();const item=id?await db.category.findFirst({where:{id,deletedAt:null},include:{createdBy:{select:{name:true}},updatedBy:{select:{name:true}}}}):null;
 if(id&&!item)notFound();
 return <><Back href="/categories"/><Heading title={item?'ویرایش دسته‌بندی':'ثبت دسته‌بندی'} subtitle="فقط کد و نام؛ ساده و کاربردی."/><div className="form-panel"><ActionForm action="category.save" id={item?.id}><div className="form-grid"><label className="field">کد دسته‌بندی<input name="code" defaultValue={item?.code} required maxLength={40} dir="ltr" placeholder="CAT-001"/></label><label className="field">نام دسته‌بندی<input name="name" defaultValue={item?.name} required minLength={2} maxLength={100} placeholder="مثلاً ملزومات اداری"/></label></div></ActionForm>{item&&<Audit item={item}/>}</div>{item&&<div className="delete-section"><p>حذف دسته‌بندی دارای کالای فعال مجاز نیست.</p><ActionForm action="category.delete" id={item.id} label="حذف دسته‌بندی" danger confirm="این دسته‌بندی حذف شود؟"/></div>}</>;
}
