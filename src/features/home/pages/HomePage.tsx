'use client';

import '../chet-home.css';
import { BurgerHero } from '../components/BurgerHero';
import { HomeDiscovery } from '../components/HomeDiscovery';
import { PublicGallery } from '@/features/galeria/components/PublicGallery';
import type { GalleryState } from '@/features/galeria/services/gallery.service';
import { OrderingMenuSection } from '@/features/catalogo/components/OrderingMenuSection';
import { PublicShell } from '@/shared/components/layout/PublicShell';

export function HomePage({ initialGallery }: { initialGallery: GalleryState | null }) {
  return (
    <PublicShell>
      <main className="chet-home">
        <BurgerHero />
        <HomeDiscovery />
        <PublicGallery initialGallery={initialGallery} />
        <OrderingMenuSection />
      </main>
    </PublicShell>
  );
}
