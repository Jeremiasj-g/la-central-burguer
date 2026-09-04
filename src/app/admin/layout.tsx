import { Manrope } from 'next/font/google';

const adminFont = Manrope({
  subsets: ['latin'],
  display: 'swap',
});

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${adminFont.className} min-h-screen`}>{children}</div>;
}
