'use client';

import { BurgerHero } from '../components/BurgerHero';
import { PublicGallery } from '@/features/galeria/components/PublicGallery';
import type { GalleryState } from '@/features/galeria/services/gallery.service';
import { OrderingMenuSection } from '@/features/catalogo/components/OrderingMenuSection';
import { PublicShell } from '@/shared/components/layout/PublicShell';

export function HomePage({ initialGallery }: { initialGallery: GalleryState | null }) {
  return (
    <PublicShell>
      <BurgerHero />
      <PublicGallery initialGallery={initialGallery} />
      <OrderingMenuSection />
    </PublicShell>
  );
}
