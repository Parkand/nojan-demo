import Link from 'next/link';
import { LogOut } from '@/components/icons';
import { requireUser } from '@/lib/auth';
import { logoutAction } from '@/lib/actions';
import { db } from '@/lib/db';
import { Brand } from '@/components/ui';
import { Navigation } from '@/components/navigation';
import InstallApp from '@/components/install-app';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const unreadNotificationCount = await db.notification.count({
    where: {
      recipientId: user.id,
      readAt: null
    }
  });

  const roleLabel =
    user.role === 'SUPER_ADMIN'
      ? 'مدیر ارشد'
      : user.role === 'ADMIN'
        ? 'مدیر'
        : 'کارمند';

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>

      <header className="topbar">
        <Link href="/orders" aria-label="نوژان، صفحه سفارش‌ها">
          <Brand />
        </Link>

        <div className="account">
          <div className="account-text">
            <strong>{user.name}</strong>
            <span>{roleLabel}</span>
          </div>

          <span className="avatar">{user.name.slice(0, 1)}</span>

          <form action={logoutAction}>
            <button
              type="submit"
              title="خروج از حساب"
              aria-label="خروج از حساب"
              className="icon-button"
            >
              <LogOut size={20} />
            </button>
          </form>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-label">مدیریت و دسترسی‌ها</div>

        <Navigation
          canManageUsers={user.role === 'SUPER_ADMIN'}
          unreadNotificationCount={unreadNotificationCount}
        />

        <div className="sidebar-note">
          <span className="status-dot" />
          فضای کاری شما
          <br />
          <small>ساده و یکپارچه، با نوژان</small>
        </div>
      </aside>

      <main id="main-content" className="main-content">
        {children}

        <InstallApp />

        <footer className="workspace-footer">
          نوژان · مدیریت سفارش کالا
        </footer>
      </main>
    </div>
  );
}