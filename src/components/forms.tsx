'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus, Trash2, Eye, EyeOff } from '@/components/icons';
import { mutateAction, loginAction } from '@/lib/actions';
import type { ActionState } from '@/lib/types';
export function Submit({children,className='btn primary'}:{children:React.ReactNode,className?:string}) {
  const {pending}=useFormStatus();
  return <button className={className} type="submit" disabled={pending}>{pending?<><LoaderCircle size={18} className="spin"/> در حال انجام…</>:children}</button>;
}
export function ActionForm({children,action,id,label='ذخیره اطلاعات',confirm,className='',danger=false}:{children?:React.ReactNode,action:string,id?:number,label?:string,confirm?:string,className?:string,danger?:boolean}) {
  const [state,formAction]=useActionState<ActionState,FormData>(mutateAction,{});
  return <form action={formAction} className={'action-form '+className} onSubmit={e=>{if(confirm&&!window.confirm(confirm))e.preventDefault();}}>
    <input type="hidden" name="action" value={action}/>{id&&<input type="hidden" name="id" value={id}/>}
    {children}{state.error&&<div role="alert" className="alert error">{state.error}</div>}
    <Submit className={danger?'btn danger':'btn primary'}>{label}</Submit>
  </form>;
}
export function PasswordInput({required=false,editing=false}:{required?:boolean,editing?:boolean}) {
  const [visible,setVisible]=useState(false);
  return <label className="field">{editing?'رمز عبور جدید (اختیاری)':'رمز عبور'}<span className="password-field">
    <input name="password" type={visible?'text':'password'} required={required} minLength={editing||required?10:undefined} maxLength={64} autoComplete="new-password" dir="ltr" placeholder={editing?'بدون تغییر بگذارید':'حداقل ۱۰ نویسه'}/>
    <button type="button" className="icon-button" onClick={()=>setVisible(!visible)} aria-label={visible?'پنهان کردن رمز':'نمایش رمز'}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button>
  </span></label>;
}
export function LoginForm() {
  const [state,action]=useActionState<ActionState,FormData>(loginAction,{});
  const [visible,setVisible]=useState(false);
  return <form action={action} className="login-form">
    <label className="field">نام کاربری<input name="username" dir="ltr" autoComplete="username" placeholder="username" required maxLength={64} autoCapitalize="none" spellCheck={false}/></label>
    <label className="field">رمز عبور<span className="password-field"><input name="password" type={visible?'text':'password'} dir="ltr" autoComplete="current-password" required maxLength={128} placeholder="رمز عبور خود را وارد کنید"/><button className="icon-button" type="button" aria-label="نمایش یا پنهان کردن رمز" onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></label>
    {state.error&&<div className="alert error" role="alert">{state.error}</div>}
    <Submit>ورود به نوژان <span aria-hidden="true">←</span></Submit>
    <p className="form-footnote">برای دریافت حساب کاربری با مدیر تماس بگیرید.</p>
  </form>;
}
type ProductOption={id:number,name:string,code:string,unit:string,categoryName:string};
type Row={productId:string,currentStock:string,requiredQuantity:string};
export function OrderForm({products,id,date,initialItems}:{products:ProductOption[],id?:number,date:string,initialItems?:Row[]}) {
  const [rows,setRows]=useState<Row[]>(initialItems?.length?initialItems:[{productId:'',currentStock:'0',requiredQuantity:''}]);
  const [query,setQuery]=useState('');
  const patch=(index:number,key:keyof Row,value:string)=>setRows(old=>old.map((row,i)=>i===index?{...row,[key]:value}:row));
  return <ActionForm action="order.save" id={id} label={id?'ذخیره تغییرات سفارش':'ثبت سفارش'}>
    <input type="hidden" name="items" value={JSON.stringify(rows)}/>
    <div className="form-grid"><label className="field">تاریخ سفارش<input type="date" name="orderDate" required defaultValue={date} min="2000-01-01" max="2100-12-31" dir="ltr"/><small>ورودی مرورگر؛ تاریخ در فهرست به شمسی نمایش داده می‌شود.</small></label>
    <label className="field">جستجو میان کالاهای قابل انتخاب<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام کالا، کد یا دسته‌بندی…"/></label></div>
    <div className="section-label"><h2>اقلام سفارش</h2><span className="badge neutral">{new Intl.NumberFormat('fa').format(rows.length)} قلم</span></div>
    <div className="order-lines">{rows.map((row,index)=>{
      const selected=products.find(p=>String(p.id)===row.productId);
      const options=products.filter(p=>String(p.id)===row.productId||(!rows.some((r,i)=>i!==index&&r.productId===String(p.id))&&`${p.name} ${p.code} ${p.categoryName}`.toLowerCase().includes(query.toLowerCase())));
      return <section className="order-line" key={index}>
        <div className="line-heading"><strong>کالای {new Intl.NumberFormat('fa').format(index+1)}</strong><button type="button" className="icon-button red" disabled={rows.length===1} onClick={()=>setRows(old=>old.filter((_,i)=>i!==index))} aria-label={`حذف آیتم ${index+1}`}><Trash2 size={18}/></button></div>
        <label className="field">کالا<select value={row.productId} onChange={e=>patch(index,'productId',e.target.value)} required><option value="">انتخاب کالا…</option>{row.productId&&!selected&&<option value={row.productId} disabled>کالای حذف‌شده — جایگزین کنید</option>}{options.map(p=><option key={p.id} value={p.id}>{p.name} · {p.code} · {p.unit}</option>)}</select></label>
        {selected&&<div className="line-meta">دسته‌بندی: {selected.categoryName}<span>واحد: {selected.unit}</span></div>}
        <div className="form-grid compact"><label className="field">موجودی فعلی<input type="text" inputMode="decimal" maxLength={13} required dir="ltr" value={row.currentStock} onChange={e=>patch(index,'currentStock',e.target.value)} placeholder="0"/></label><label className="field">مقدار مورد نیاز<input type="text" inputMode="decimal" maxLength={13} required dir="ltr" value={row.requiredQuantity} onChange={e=>patch(index,'requiredQuantity',e.target.value)} placeholder="0"/></label></div>
      </section>;
    })}</div>
    <button className="btn dashed" type="button" disabled={rows.length>=100||rows.length>=products.length} onClick={()=>setRows([...rows,{productId:'',currentStock:'0',requiredQuantity:''}])}><Plus size={18}/> افزودن کالای دیگر</button>
    <p className="form-footnote">اعداد فارسی و انگلیسی با حداکثر سه رقم اعشار پذیرفته می‌شوند. برای اعشار از نقطه استفاده کنید. موجودی به‌صورت خودکار محاسبه نمی‌شود.</p>
  </ActionForm>;
}
