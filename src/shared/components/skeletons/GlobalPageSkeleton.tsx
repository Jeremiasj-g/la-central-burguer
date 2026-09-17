import { BurgerLoader } from '@/shared/components/ui/BurgerLoader';

export function GlobalPageSkeleton() {
  return (
    <main className="grid min-h-screen place-items-center bg-central-carbon">
      <BurgerLoader />
    </main>
  );
}
