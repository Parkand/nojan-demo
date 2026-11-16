// src/components/navigation.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Package, Tags, Users } from '@/components/icons';
import styles from './navigation.module.css';

function TaskIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m7 8 1.5 1.5L11 7M14 8h3m-10 7 1.5 1.5L11 14M14 15h3" />
    </svg>
  );
}

function RequestIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

function NotificationIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}

const groups = [
  {
    id: 'orders',
    title: 'سفارش‌ها و اطلاعات پایه',
    restricted: false,
    links: [
      { href: '/orders', name: 'سفارش‌ها', icon: ClipboardList },
      { href: '/products', name: 'کالاها', icon: Package },
      { href: '/categories', name: 'دسته‌بندی‌ها', icon: Tags },
    ],
  },
  {
    id: 'workflow',
    title: 'وظایف و پیگیری',
    restricted: false,
    links: [
      { href: '/tasks', name: 'وظایف', icon: TaskIcon },
      { href: '/requests', name: 'درخواست‌ها', icon: RequestIcon },
      { href: '/notifications', name: 'اعلان‌ها', icon: NotificationIcon },
    ],
  },
  {
    id: 'management',
    title: 'مدیریت و دسترسی‌ها',
    restricted: true,
    links: [{ href: '/users', name: 'کاربران', icon: Users }],
  },
];

const numberFormatter = new Intl.NumberFormat('fa-IR');

type NavigationProps = {
  canManageUsers?: boolean;
  unreadNotificationCount?: number;
};

export function Navigation({
  canManageUsers = false,
  unreadNotificationCount = 0,
}: NavigationProps) {
  const pathname = usePathname();
  const unreadCount = Number.isFinite(unreadNotificationCount)
    ? Math.max(0, Math.floor(unreadNotificationCount))
    : 0;
  const formattedCount = numberFormatter.format(unreadCount);
  const badgeText = unreadCount > 99 ? '۹۹+' : formattedCount;

  return (
    <nav className={styles.navigation} aria-label="منوی اصلی">
      {groups.filter(group => !group.restricted || canManageUsers).map(group => (
        <section className={styles.group} key={group.id} aria-label={group.title}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <ul className={styles.links}>
            {group.links.map(({ href, name, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const isNotifications = href === '/notifications';
              const accessibleLabel = isNotifications
                ? unreadCount > 0
                  ? `اعلان‌ها، ${formattedCount} اعلان خوانده‌نشده`
                  : 'اعلان‌ها، بدون اعلان خوانده‌نشده'
                : undefined;

              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`${styles.link}${active ? ` ${styles.active}` : ''}`}
                    aria-current={active ? 'page' : undefined}
                    aria-label={accessibleLabel}
                    title={accessibleLabel}
                  >
                    <span className={styles.icon} aria-hidden="true"><Icon size={21} /></span>
                    <span className={styles.linkText}>{name}</span>
                    {isNotifications && unreadCount > 0 && (
                      <span className={styles.badge} aria-hidden="true" dir="ltr">{badgeText}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
