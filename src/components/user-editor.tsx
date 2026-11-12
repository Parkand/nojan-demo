import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { Back,Heading,Audit } from './ui';
import { ActionForm,PasswordInput } from './forms';
export async function UserEditor({id}:{id?:number}) {
 const actor=await requireAdmin();
 const item=id?await db.user.findFirst({where:{id,deletedAt:null},select:{id:true,name:true,username:true,role:true,createdAt:true,updatedAt:true,createdBy:{select:{name:true}},updatedBy:{select:{name:true}}}}):null;
 if(id&&!item)notFound();
 return <><Back href="/users"/><Heading title={item?'ویرایش کاربر':'ثبت کاربر جدید'} subtitle="تأیید سفارش و مدیریت اطلاعات پایه فقط با نقش مدیر امکان‌پذیر است."/><div className="form-panel"><ActionForm action="user.save" id={item?.id}><div className="form-grid"><label className="field">نام و نام خانوادگی<input name="name" defaultValue={item?.name} required minLength={2} maxLength={100}/></label><label className="field">نام کاربری<input name="username" defaultValue={item?.username} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]{3,64}" dir="ltr" autoComplete="off" autoCapitalize="none" spellCheck={false}/><small>حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط</small></label><label className="field">نقش<select name="role" defaultValue={item?.role??'USER'} required>{item?.id!==actor.id&&<option value="USER">کاربر</option>}<option value="ADMIN">مدیر</option></select></label><PasswordInput required={!item} editing={!!item}/></div>{item&&<p className="form-footnote">ذخیره تغییرات، نشست‌های قبلی این کاربر را باطل می‌کند و محدودیت ورود او را بازنشانی می‌کند. ویرایش حساب خودتان نیازمند ورود مجدد است.</p>}</ActionForm>{item&&<Audit item={item}/>}</div>{item&&item.id!==actor.id&&<div className="delete-section"><p>حذف کاربر، دسترسی ورود او را قطع می‌کند؛ سفارش‌های قبلی حفظ می‌شوند.</p><ActionForm action="user.delete" id={item.id} label="حذف کاربر" danger confirm="حساب این کاربر به‌صورت نرم حذف شود؟"/></div>}</>;
}
