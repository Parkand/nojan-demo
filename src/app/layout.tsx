import type { Metadata, Viewport } from 'next';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import './globals.css';
export const metadata: Metadata = {title:{default:'نوژان | مدیریت سفارش کالا',template:'%s | نوژان'},description:'سامانه ساده و یکپارچه مدیریت سفارش کالا',robots:{index:false,follow:false},icons:{icon:'/icon.svg'}};
export const viewport:Viewport = {width:'device-width',initialScale:1,themeColor:'#C82032'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
