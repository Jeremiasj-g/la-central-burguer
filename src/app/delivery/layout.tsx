import { Manrope } from 'next/font/google';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-delivery',
  weight: ['400', '500', '600', '700'],
});

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${manrope.className} ${manrope.variable}`}>{children}</div>;
}
