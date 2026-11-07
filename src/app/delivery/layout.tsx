import type { Metadata } from 'next';

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

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>{children}</div>;
}
