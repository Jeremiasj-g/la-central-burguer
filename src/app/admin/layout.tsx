import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { AdminPwaProvider } from '@/shared/components/layout/AdminPwaProvider';

export const metadata: Metadata = {
  title: { default: 'La Central Burger Admin', template: '%s | La Central Admin' },
  description: 'Panel de administración de La Central Burger.',
  manifest: '/admin-manifest.webmanifest',
  applicationName: 'La Central Burger Admin',
  appleWebApp: { capable: true, title: 'Central Admin', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/admin-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/admin-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#F5F5F5',
};

const adminFont = Manrope({
  subsets: ['latin'],
  display: 'swap',
});

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${adminFont.className} min-h-screen`}><AdminPwaProvider>{children}</AdminPwaProvider></div>;
}
