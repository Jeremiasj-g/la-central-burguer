'use client';

import '../chet-home.css';
import { useCallback, useEffect, useState } from 'react';
import { BurgerHero } from '../components/BurgerHero';
import { HomeDiscovery } from '../components/HomeDiscovery';
import { PublicGallery } from '@/features/galeria/components/PublicGallery';
import type { GalleryState } from '@/features/galeria/services/gallery.service';
import { OrderingMenuSection } from '@/features/catalogo/components/OrderingMenuSection';
import { PublicShell } from '@/shared/components/layout/PublicShell';

export function HomePage({ initialGallery }: { initialGallery: GalleryState | null }) {
  const [bestSellerToOpen, setBestSellerToOpen] = useState<string | null>(null);
  const clearBestSellerSelection = useCallback(() => setBestSellerToOpen(null), []);
  // La clase permite estilizar también los modales y el carrito montados en document.body.
  useEffect(() => {
    document.body.classList.add('chet-customer-active');
    return () => document.body.classList.remove('chet-customer-active');
  }, []);

  return (
    <PublicShell>
      <main className="chet-home">
        <BurgerHero />
        <HomeDiscovery onSelectProduct={setBestSellerToOpen} />
        <PublicGallery initialGallery={initialGallery} />
        <OrderingMenuSection requestedProductId={bestSellerToOpen} onRequestHandled={clearBestSellerSelection} />
      </main>
    </PublicShell>
  );
}
