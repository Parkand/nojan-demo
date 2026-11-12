import Link from 'next/link';
export default function NotFound(){return <main className="error-page"><span className="error-number">۴۰۴</span><h1>این صفحه در دسترس نیست</h1><p>ممکن است اطلاعات حذف شده باشد یا اجازه مشاهده آن را نداشته باشید.</p><Link className="btn primary" href="/orders">بازگشت به سفارش‌ها</Link></main>;}
