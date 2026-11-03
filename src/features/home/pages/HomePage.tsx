'use client';

import { useCallback, useState } from 'react';
import { HomeBestSellers } from '../components/HomeBestSellers';
import { BurgerHero } from '../components/BurgerHero';
import { PublicGallery } from '@/features/galeria/components/PublicGallery';
import type { GalleryState } from '@/features/galeria/services/gallery.service';
import { OrderingMenuSection } from '@/features/catalogo/components/OrderingMenuSection';
import { PublicShell } from '@/shared/components/layout/PublicShell';

export function HomePage({ initialGallery }: { initialGallery: GalleryState | null }) {
  const [bestSellerToOpen, setBestSellerToOpen] = useState<string | null>(null);
  const clearBestSellerSelection = useCallback(() => setBestSellerToOpen(null), []);
  return (
    <PublicShell>
      <BurgerHero />
      <HomeBestSellers onSelectProduct={setBestSellerToOpen} />
      <PublicGallery initialGallery={initialGallery} />
      <OrderingMenuSection requestedProductId={bestSellerToOpen} onRequestHandled={clearBestSellerSelection} />
    </PublicShell>
  );
}
