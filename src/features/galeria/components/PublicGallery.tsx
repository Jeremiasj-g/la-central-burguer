'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import { A11y } from 'swiper/modules';
import { getGalleryState, subscribeGallery, type GalleryState } from '../services/gallery.service';

export function PublicGallery() {
  const [gallery, setGallery] = useState<GalleryState | null>(null);
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getGalleryState().then(data => {
        if (active) setGallery(data);
      }).catch(() => { if (active) setGallery(null); });
    };
    refresh();
    const stop = subscribeGallery(refresh);
    return () => { active = false; stop(); };
  }, []);

  if (!gallery?.enabled || gallery.images.length === 0) return null;

  return (
    <section aria-label="Galería de La Central Burger" className="brick-wall lcb-food-gallery relative overflow-hidden px-5 py-8 text-central-cream sm:px-6 sm:py-11 lg:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.22em] text-central-orange">La Central en fotos</p>
            <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-semibold tracking-[-.04em]">Galería de La Central</h2>
          </div>
          {gallery.images.length > 1 ? (
            <div className="flex gap-2">
              <button type="button" aria-label="Foto anterior" disabled={index === 0} onClick={() => swiper?.slidePrev()} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[#1d1d1d]/90 text-central-cream transition-colors hover:border-central-orange disabled:opacity-35"><ChevronLeft size={18} /></button>
              <button type="button" aria-label="Foto siguiente" disabled={index >= gallery.images.length - (swiper?.slidesPerViewDynamic() ?? 1)} onClick={() => swiper?.slideNext()} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[#1d1d1d]/90 text-central-cream transition-colors hover:border-central-orange disabled:opacity-35"><ChevronRight size={18} /></button>
            </div>
          ) : null}
        </div>
        <Swiper modules={[A11y]} slidesPerView={1.16} spaceBetween={12}
          breakpoints={{ 640: { slidesPerView: 2.1, spaceBetween: 14 }, 1024: { slidesPerView: 3, spaceBetween: 16 } }}
          onSwiper={setSwiper}
          onSlideChange={s => setIndex(s.activeIndex)}
          onResize={s => setIndex(s.activeIndex)}
          className="lcb-food-swiper !overflow-hidden">
          {gallery.images.map((image) => (
            <SwiperSlide key={image.id}>
              <div className="relative h-[205px] overflow-hidden rounded-[17px] border border-white/10 bg-[#1d1d1d] sm:h-[255px] lg:h-[275px]">
                <img loading="lazy" src={image.image_url} alt={image.alt_text || 'Fotografía de La Central Burger'} className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]" />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
