import type { CSSProperties } from 'react';
import './public.css';
import './display.css';
import { PublicTypographyPortalSync } from './PublicTypographyPortalSync';
import { PublicThemeProvider } from '@/shared/components/layout/PublicThemeProvider';
import { PublicSectionNavigation } from '@/shared/components/layout/PublicSectionNavigation';
import './light.css';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site" style={{ fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", '--font-public-display': "'Oswald', Impact, sans-serif" } as CSSProperties}>
      <PublicTypographyPortalSync />
      <PublicSectionNavigation />
      <PublicThemeProvider>{children}</PublicThemeProvider>
    </div>
  );
}
