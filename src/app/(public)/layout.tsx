import { Oswald, Outfit } from 'next/font/google';
import './public.css';
import './display.css';
import { PublicTypographyPortalSync } from './PublicTypographyPortalSync';

const publicFont = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const publicDisplayFont = Oswald({
  subsets: ['latin'],
  weight: ['600', '800'],
  display: 'swap',
  variable: '--font-public-display',
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${publicFont.className} ${publicDisplayFont.variable} public-site`}>
      <PublicTypographyPortalSync />
      {children}
    </div>
  );
}
