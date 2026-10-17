'use client';

import { BurgerHero } from '../components/BurgerHero';
import { PublicGallery } from '@/features/galeria/components/PublicGallery';
import { OrderingMenuSection } from '@/features/catalogo/components/OrderingMenuSection';
import { PublicShell } from '@/shared/components/layout/PublicShell';

export function HomePage() {
  return (
    <PublicShell>
      <BurgerHero />
      <PublicGallery />
      <OrderingMenuSection />
    </PublicShell>
  );
}
