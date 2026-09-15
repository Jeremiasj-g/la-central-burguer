import { Outfit } from 'next/font/google';
import './public.css';
import './display.css';
import { PublicTypographyPortalSync } from './PublicTypographyPortalSync';

const publicFont = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${publicFont.className} public-site`}>
      <PublicTypographyPortalSync />
      {children}
    </div>
  );
}
