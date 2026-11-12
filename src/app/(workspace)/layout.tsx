import Link from 'next/link';
import { LogOut } from '@/components/icons';
import { requireUser } from '@/lib/auth';
import { logoutAction } from '@/lib/actions';
import { Brand } from '@/components/ui';
import { Navigation } from '@/components/navigation';
export const dynamic='force-dynamic';
export default async function WorkspaceLayout({children}:{children:React.ReactNode}) {
 const user=await requireUser();
 return <div className="workspace"><a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a><header className="topbar"><Link href="/orders" aria-label="نوژان، صفحه سفارش‌ها"><Brand/></Link><div className="account"><div className="account-text"><strong>{user.name}</strong><span>{user.role==='ADMIN'?'مدیر سیستم':'کاربر'}</span></div><span className="avatar">{user.name.slice(0,1)}</span><form action={logoutAction}><button title="خروج از حساب" aria-label="خروج از حساب" className="icon-button"><LogOut size={20}/></button></form></div></header><aside className="sidebar"><div className="sidebar-label">مدیریت و دسترسی‌ها</div><Navigation admin={user.role==='ADMIN'}/><div className="sidebar-note"><span className="status-dot"/> فضای کاری شما<br/><small>ساده و یکپارچه، با نوژان</small></div></aside><main id="main-content" className="main-content">{children}<footer className="workspace-footer">نوژان · مدیریت سفارش کالا</footer></main></div>;
}
