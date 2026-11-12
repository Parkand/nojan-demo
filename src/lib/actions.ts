'use server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireUser, createSession, clearSession } from './auth';
import { latinDigits } from './utils';
import type { ActionState } from './types';
const txt=(f:FormData,k:string)=>String(f.get(k)??'').trim();
const idSchema=z.coerce.number().int().positive();
const nameSchema=z.string().trim().min(2,'نام باید حداقل دو حرف باشد.').max(100,'نام بیش از حد طولانی است.');
const codeSchema=z.string().trim().min(1,'کد الزامی است.').max(40,'کد حداکثر ۴۰ نویسه است.');
const userSchema=z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,64}$/,'نام کاربری باید ۳ تا ۶۴ نویسه انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.');
const passSchema=z.string().min(10,'رمز عبور حداقل ۱۰ نویسه باشد.').max(64,'رمز عبور حداکثر ۶۴ نویسه باشد.').refine(p=>Buffer.byteLength(p,'utf8')<=72,'رمز عبور با این حروف بیش از حد طولانی است.');
function fail(message:string):never { throw new Error(message); }
function message(error:unknown) {
  if(error instanceof z.ZodError) return error.issues[0]?.message ?? 'ورودی نامعتبر است.';
  if(error instanceof Prisma.PrismaClientKnownRequestError) {
    if(error.code==='P2002') return 'این کد یا نام کاربری قبلاً ثبت شده است؛ حتی اگر حذف شده باشد.';
    if(error.code==='P2034') return 'اطلاعات هم‌زمان تغییر کرده‌اند. دوباره تلاش کنید.';
    console.error('Database operation failed:',error.code);
    return 'عملیات پایگاه داده انجام نشد. دوباره تلاش کنید.';
  }
  if(error instanceof Error && !(error instanceof Prisma.PrismaClientInitializationError) && !(error instanceof Prisma.PrismaClientValidationError)) return error.message;
  console.error(error); return 'خطای ارتباط با دیتابیس. تنظیمات اتصال را بررسی کنید.';
}
// Row locks in SERIALIZABLE transactions protect approvals, category removal and the last admin.
const transaction=<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>db.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000});
export async function loginAction(_:ActionState,f:FormData):Promise<ActionState> {
  try {
    const username=userSchema.parse(txt(f,'username'));
    const password=String(f.get('password')??'');
    if(!password || password.length>128) return {error:'نام کاربری یا رمز عبور نادرست است.'};
    const user=await db.user.findUnique({where:{username}});
    // Always run bcrypt, including unknown usernames, to reduce timing-based enumeration.
    const valid=await bcrypt.compare(password,user?.passwordHash??'$2b$12$C6UzMDM.H6dfI/f/IKcEe.5tE2HgbE5ZV6HVUOD90WWsj3Dl7V1bK');
    if(!user || user.deletedAt) return {error:'نام کاربری یا رمز عبور نادرست است.'};
    if(user.lockedUntil && user.lockedUntil>new Date()) return {error:'ورود موقتاً محدود شده؛ ۱۵ دقیقه بعد تلاش کنید.'};
    if(!valid) {
      await transaction(async tx=>{
        const latest=await tx.user.findUniqueOrThrow({where:{id:user.id}});
        const attempts=latest.lockedUntil && latest.lockedUntil<=new Date()?1:latest.failedLoginAttempts+1;
        await tx.user.update({where:{id:user.id},data:{failedLoginAttempts:attempts,lockedUntil:attempts>=5?new Date(Date.now()+15*60*1000):null}});
      });
      return {error:'نام کاربری یا رمز عبور نادرست است.'};
    }
    await db.user.update({where:{id:user.id},data:{failedLoginAttempts:0,lockedUntil:null}});
    await createSession(user.id,user.sessionVersion);
  } catch(e) { console.error('Login failed',e); return {error:'ورود انجام نشد. اطلاعات ورودی و اتصال دیتابیس را بررسی کنید.'}; }
  redirect('/orders');
}
export async function logoutAction() { await clearSession(); redirect('/login'); }
export async function mutateAction(_:ActionState,f:FormData):Promise<ActionState> {
  const actor=await requireUser();
  let destination='/orders';
  try {
    const action=txt(f,'action');
    const id=txt(f,'id')?idSchema.parse(txt(f,'id')):null;
    const isAdmin=actor.role==='ADMIN';
    if(!action.startsWith('order.') && !isAdmin) fail('دسترسی به این عملیات ندارید.');
    const created={createdById:actor.id,updatedById:actor.id};
    const updated={updatedById:actor.id};
    const removed={deletedAt:new Date(),deletedById:actor.id,...updated};
    if(action==='category.save') {
      const data={code:codeSchema.parse(txt(f,'code')),name:nameSchema.parse(txt(f,'name'))};
      await transaction(async tx=>{
        if(id) {
          if(!await tx.category.findFirst({where:{id,deletedAt:null}})) fail('دسته‌بندی پیدا نشد.');
          await tx.category.update({where:{id},data:{...data,...updated}});
        } else await tx.category.create({data:{...data,...created}});
      }); destination='/categories';
    } else if(action==='category.delete') {
      if(!id) fail('شناسه نامعتبر است.');
      await transaction(async tx=>{
        if(!await tx.category.findFirst({where:{id,deletedAt:null}})) fail('دسته‌بندی پیدا نشد.');
        if(await tx.product.count({where:{categoryId:id,deletedAt:null}})) fail('ابتدا کالاهای فعال این دسته‌بندی را منتقل یا حذف کنید.');
        await tx.category.update({where:{id},data:removed});
      }); destination='/categories';
    } else if(action==='product.save') {
      const data={code:codeSchema.parse(txt(f,'code')),name:z.string().min(2,'نام کالا الزامی است.').max(160).parse(txt(f,'name')),unit:z.string().min(1,'واحد الزامی است.').max(30).parse(txt(f,'unit')),categoryId:idSchema.parse(txt(f,'categoryId'))};
      await transaction(async tx=>{
        if(!await tx.category.findFirst({where:{id:data.categoryId,deletedAt:null}})) fail('دسته‌بندی فعال را انتخاب کنید.');
        if(id) {
          if(!await tx.product.findFirst({where:{id,deletedAt:null}})) fail('کالا پیدا نشد.');
          await tx.product.update({where:{id},data:{...data,...updated}});
        } else await tx.product.create({data:{...data,...created}});
      }); destination='/products';
    } else if(action==='product.delete') {
      if(!id) fail('شناسه نامعتبر است.');
      const result=await db.product.updateMany({where:{id,deletedAt:null},data:removed});
      if(!result.count) fail('کالا پیدا نشد.');
      destination='/products';
    } else if(action==='user.save' || action==='user.delete') {
      const data=action==='user.save'?{name:nameSchema.parse(txt(f,'name')),username:userSchema.parse(txt(f,'username')),role:z.enum(['USER','ADMIN']).parse(txt(f,'role'))}:null;
      const password=String(f.get('password')??'');
      const passwordHash=password?await bcrypt.hash(passSchema.parse(password),12):undefined;
      if(action==='user.save' && !id && !passwordHash) fail('رمز عبور برای کاربر جدید الزامی است.');
      await transaction(async tx=>{
        // Re-read the acting admin inside the transaction; stale sessions cannot elevate privileges.
        const current=await tx.user.findFirst({where:{id:actor.id,deletedAt:null,role:'ADMIN'}});
        if(!current) fail('دسترسی مدیر معتبر نیست.');
        if(id) {
          const target=await tx.user.findFirst({where:{id,deletedAt:null}});
          if(!target) fail('کاربر پیدا نشد.');
          if(id===actor.id && (action==='user.delete' || data?.role!=='ADMIN')) fail('حذف حساب خود یا تغییر نقش خودتان مجاز نیست.');
          if(target.role==='ADMIN' && (action==='user.delete'||data?.role!=='ADMIN')) {
            if(await tx.user.count({where:{role:'ADMIN',deletedAt:null}})<=1) fail('حداقل یک مدیر فعال باید باقی بماند.');
          }
          if(action==='user.delete') await tx.user.update({where:{id},data:{...removed,sessionVersion:{increment:1}}});
          else await tx.user.update({where:{id},data:{...data!,...(passwordHash?{passwordHash}:{}),...updated,sessionVersion:{increment:1},failedLoginAttempts:0,lockedUntil:null}});
        } else if(data) await tx.user.create({data:{...data,passwordHash:passwordHash!,...created}});
        else fail('شناسه نامعتبر است.');
      }); destination='/users';
    } else if(action==='order.save') {
      const raw=String(f.get('items')??'');
      if(raw.length>30000) fail('تعداد آیتم‌ها بیش از حد مجاز است.');
      const quantity=z.string().transform(latinDigits).pipe(z.string().regex(/^\d{1,9}(\.\d{1,3})?$/,'مقدار باید مثبت و حداکثر با سه رقم اعشار باشد.'));
      const rows=z.array(z.object({productId:idSchema,currentStock:quantity,requiredQuantity:quantity.refine(v=>Number(v)>0,'مقدار مورد نیاز باید بیشتر از صفر باشد.')})).min(1,'حداقل یک کالا اضافه کنید.').max(100,'حداکثر ۱۰۰ آیتم مجاز است.').parse(JSON.parse(raw||'[]'));
      if(new Set(rows.map(r=>r.productId)).size!==rows.length) fail('یک کالا را نمی‌توان دو بار در سفارش ثبت کرد.');
      const dateText=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'تاریخ سفارش الزامی است.').parse(txt(f,'orderDate'));
      const date=new Date(dateText+'T00:00:00Z');
      if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==dateText||dateText<'2000-01-01'||dateText>'2100-12-31') fail('تاریخ سفارش معتبر نیست.');
      const saved=await transaction(async tx=>{
        let orderId=id;
        if(id) {
          const order=await tx.order.findFirst({where:{id,deletedAt:null}});
          if(!order || (!isAdmin && order.userId!==actor.id)) fail('سفارش پیدا نشد یا دسترسی ندارید.');
          if(order.approvedAt) fail('سفارش تأییدشده قابل تغییر نیست.');
          await tx.order.update({where:{id},data:{orderDate:date,...updated}});
        }
        if(await tx.product.count({where:{id:{in:rows.map(r=>r.productId)},deletedAt:null,category:{deletedAt:null}}})!==rows.length) fail('یک یا چند کالا حذف شده‌اند. کالاهای فعال را انتخاب کنید.');
        if(!orderId) orderId=(await tx.order.create({data:{orderDate:date,userId:actor.id,...created}})).id;
        else await tx.orderItem.updateMany({where:{orderId,deletedAt:null},data:removed});
        await tx.orderItem.createMany({data:rows.map(row=>({...row,orderId:orderId!,...created}))});
        return orderId;
      }); destination=`/orders/${saved}`;
    } else if(action==='order.delete'||action==='order.approve') {
      if(!id) fail('شناسه نامعتبر است.');
      if(action==='order.approve'&&!isAdmin) fail('تأیید سفارش فقط توسط مدیر مجاز است.');
      await transaction(async tx=>{
        const order=await tx.order.findFirst({where:{id,deletedAt:null}});
        if(!order||(!isAdmin&&order.userId!==actor.id)) fail('سفارش پیدا نشد یا دسترسی ندارید.');
        if(order.approvedAt) fail('سفارش تأییدشده قابل تغییر یا حذف نیست.');
        if(action==='order.approve') await tx.order.update({where:{id},data:{approvedAt:new Date(),approvedById:actor.id,...updated}});
        else {
          await tx.order.update({where:{id},data:removed});
          await tx.orderItem.updateMany({where:{orderId:id,deletedAt:null},data:removed});
        }
      }); destination=action==='order.approve'?`/orders/${id}`:'/orders';
    } else fail('عملیات نامعتبر است.');
  } catch(e) { return {error: e instanceof SyntaxError ? 'آیتم‌های سفارش معتبر نیستند.' : message(e)}; }
  revalidatePath('/','layout');
  redirect(destination+'?saved=1');
}
