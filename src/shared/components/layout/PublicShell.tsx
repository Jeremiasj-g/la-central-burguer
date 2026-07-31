import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-central-carbon text-central-cream">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
