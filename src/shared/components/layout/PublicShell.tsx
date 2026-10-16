import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { PublicMaintenanceBoundary } from './PublicMaintenanceBoundary';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <PublicMaintenanceBoundary>
      <PublicHeader />
      {children}
      <PublicFooter />
    </PublicMaintenanceBoundary>
  );
}
