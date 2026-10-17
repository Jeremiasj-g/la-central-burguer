import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';

export const metadata: Metadata = {
  title: 'La Central Burger Delivery',
  description: 'Panel de reparto de La Central Burger',
  manifest: '/delivery-manifest-v2.webmanifest',
  icons: {
    icon: [{ url: '/api/pwa/icon/192', type: 'image/png' }],
    shortcut: [{ url: '/api/pwa/icon/192', type: 'image/png' }],
    apple: [{ url: '/api/pwa/icon/512', sizes: '512x512', type: 'image/png' }],
  },
};

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-delivery',
  weight: ['400', '500', '600', '700'],
});

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${manrope.className} ${manrope.variable}`}>{children}</div>;
}
