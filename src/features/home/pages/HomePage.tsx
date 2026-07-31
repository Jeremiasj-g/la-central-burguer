'use client';

import { BurgerHero } from '../components/BurgerHero';
import { OrderingMenuSection } from '@/features/catalogo/components/OrderingMenuSection';
import { PublicShell } from '@/shared/components/layout/PublicShell';

export function HomePage() {
  return (
    <PublicShell>
      <BurgerHero />
      <OrderingMenuSection />
    </PublicShell>
  );
}
