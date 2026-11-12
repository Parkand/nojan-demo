'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{error:Error & {digest?:string},reset:()=>void}) {return <div className="error-page"><h1>دریافت اطلاعات انجام نشد</h1><p>اتصال به دیتابیس یا سرویس را بررسی کنید و دوباره تلاش کنید.</p><button className="btn primary" onClick={reset}>تلاش دوباره</button><Link className="back" href="/orders">بازگشت به سفارش‌ها</Link></div>;}
