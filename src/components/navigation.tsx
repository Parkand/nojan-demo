'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Package, Tags, Users } from '@/components/icons';
const links=[{href:'/orders',name:'سفارش‌ها',icon:ClipboardList},{href:'/products',name:'کالاها',icon:Package},{href:'/categories',name:'دسته‌بندی‌ها',icon:Tags},{href:'/users',name:'کاربران',icon:Users}];
export function Navigation({admin=false}:{admin?:boolean}) {
  const path=usePathname();
  return <nav className="navigation" aria-label="منوی اصلی">{links.filter(l=>admin||l.href!=='/users').map(({href,name,icon:Icon})=><Link key={href} href={href} className={path.startsWith(href)?'nav-link active':'nav-link'} aria-current={path.startsWith(href)?'page':undefined}><Icon size={21}/><span>{name}</span></Link>)}</nav>;
}
