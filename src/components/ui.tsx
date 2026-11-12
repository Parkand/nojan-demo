import Link from 'next/link';
import { Search, Plus, ChevronLeft, ChevronRight, Inbox, CheckCircle2, Clock3 } from '@/components/icons';
import { fa, timeFa, PAGE_SIZE } from '@/lib/utils';
export function Brand({large=false}:{large?:boolean}) { return <div className={'brand '+(large?'large':'')}><span className="brand-mark">ن</span><span><strong>نوژان</strong><small>مدیریت سفارش کالا</small></span></div>; }
export function Heading({title,subtitle,href,label}:{title:string,subtitle:string,href?:string,label?:string}) { return <div className="page-heading"><div><div className="eyebrow">فضای کاری نوژان</div><h1>{title}</h1><p>{subtitle}</p></div>{href&&<Link className="btn primary new-button" href={href}><Plus size={19}/>{label??'ثبت جدید'}</Link>}</div>; }
export function SearchBar({q,placeholder,hidden}:{q:string,placeholder:string,hidden?:Record<string,string>}) { return <form method="get" className="search-bar"><Search size={20}/><input aria-label={placeholder} name="q" type="search" defaultValue={q} placeholder={placeholder} maxLength={100}/>{Object.entries(hidden??{}).map(([k,v])=><input key={k} name={k} value={v} type="hidden"/>)}<button type="submit">جستجو</button></form>; }
export function Status({approved}:{approved:boolean}) {return <span className={'badge '+(approved?'success':'pending')}>{approved?<CheckCircle2 size={13}/>:<Clock3 size={13}/>} {approved?'تأیید شده':'در انتظار تأیید'}</span>;}
export function Empty({title='هنوز موردی ثبت نشده',description='با ثبت اولین مورد شروع کنید.'}:{title?:string,description?:string}) {return <div className="empty"><span><Inbox size={33}/></span><h2>{title}</h2><p>{description}</p></div>;}
export function Saved({show}:{show:boolean}) { return show?<div role="status" className="alert success-alert"><CheckCircle2 size={18}/> اطلاعات با موفقیت ذخیره شد.</div>:null; }
export function Pagination({page,count,path,query={}}:{page:number,count:number,path:string,query?:Record<string,string>}) {
  const pages=Math.max(1,Math.ceil(count/PAGE_SIZE));
  if(pages===1&&page===1)return null;
  const url=(p:number)=>`${path}?${new URLSearchParams({...query,page:String(p)})}`;
  return <div className="pagination">{page>1?<Link href={url(page-1)} className="btn secondary"><ChevronRight size={16}/> قبلی</Link>:<span/>}<span>صفحه {fa(page)} از {fa(pages)}</span>{page<pages?<Link href={url(page+1)} className="btn secondary">بعدی <ChevronLeft size={16}/></Link>:<span/>}</div>;
}
export function Back({href,label='بازگشت به فهرست'}:{href:string,label?:string}) {return <Link className="back" href={href}><ChevronRight size={16}/>{label}</Link>;}
export function Audit({item}:{item:{createdAt:Date,updatedAt:Date,createdBy?:{name:string}|null,updatedBy?:{name:string}|null}}) { return <div className="audit"><p>ایجاد: {timeFa(item.createdAt)}{item.createdBy&&` · ${item.createdBy.name}`}</p><p>آخرین تغییر: {timeFa(item.updatedAt)}{item.updatedBy&&` · ${item.updatedBy.name}`}</p></div>; }
