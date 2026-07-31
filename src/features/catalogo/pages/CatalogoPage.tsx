'use client';

import { OrderingMenuSection } from '../components/OrderingMenuSection';
import { PublicShell } from '@/shared/components/layout/PublicShell';
import { BurgerHero } from '@/features/home/components/BurgerHero';

export function CatalogoPage() {
  return (
    <PublicShell>
      <BurgerHero />
      <OrderingMenuSection />
    </PublicShell>
  );
}
