import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'نوژان | مدیریت سفارش کالا',
    short_name: 'نوژان',
    description: 'سامانه ساده و یکپارچه مدیریت سفارش کالا',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/orders',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#C82032',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}