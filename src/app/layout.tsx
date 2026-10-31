import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';

export const metadata: Metadata = {
  title: 'La Central Burger',
  description: 'Hamburguesas, pizzas, lomitos y sándwiches preparados al momento.',
  ...(process.env.NEXT_PUBLIC_APP_ENV === 'development' ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
