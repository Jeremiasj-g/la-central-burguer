'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GalleryLightbox } from './GalleryLightbox';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import { A11y } from 'swiper/modules';
import { subscribeGallery, type GalleryState } from '../services/gallery.service';

export function PublicGallery({ initialGallery }: { initialGallery: GalleryState | null }) {
  const [gallery, setGallery] = useState<GalleryState | null>(initialGallery);
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  const [index, setIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;

    const refresh = () => {
      // Los navegadores móviles suspenden las pestañas en segundo plano.
      // Al regresar, focus / pageshow / visibilitychange vuelven a consultar el estado.
      if (!active || document.hidden) return;

      // Evita que una respuesta antigua sobrescriba un cambio más reciente.
      pending?.abort();
      const controller = new AbortController();
      pending = controller;

      void fetch('/api/gallery', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Galería: HTTP ${response.status}`);
          return response.json() as Promise<GalleryState>;
        })
        .then((data) => {
          if (!active || controller.signal.aborted) return;

          setGallery((previous) => {
            if (previous?.enabled === data.enabled
              && previous.images.length === data.images.length
              && previous.images.every((image, i) => {
                const current = data.images[i];
                return image.id === current.id
                  && image.image_url === current.image_url
                  && image.alt_text === current.alt_text
                  && image.display_order === current.display_order;
              })) return previous;
            return data;
          });
          setSelectedImageIndex((value) =>
            value !== null && (!data.enabled || value >= data.images.length) ? null : value);
        })
        .catch((error: unknown) => {
          // Mantener visible la última galería válida aunque se caiga la red o Realtime.
          if (!active || controller.signal.aborted) return;
          console.warn('No se pudo sincronizar la galería pública:', error);
        })
        .finally(() => {
          if (pending === controller) pending = null;
        });
    };

    // Primera sincronización más las notificaciones en tiempo real de Supabase.
    refresh();
    let stop = () => {};
    try { stop = subscribeGallery(refresh); }
    catch (error) { console.warn('No se pudo suscribir la galería en tiempo real:', error); }

    // Respaldo cuando falla WebSocket; solo hace consultas con la pestaña visible.
    const interval = window.setInterval(refresh, 20_000);
    const onVisibility = () => { if (!document.hidden) refresh(); };
    const onPageShow = () => refresh(); // Incluye restauración desde back-forward cache.
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      pending?.abort();
      stop();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!gallery?.enabled || gallery.images.length === 0) return null;

  return (
    <>
      <section aria-label="Galería de La Central Burger" className="lcb-food-gallery relative overflow-hidden px-5 py-8 text-central-cream sm:px-6 sm:py-11 lg:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-[6%] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,178,26,.14)_0%,rgba(255,178,26,.06)_37%,transparent_72%)] blur-3xl sm:left-[22%] sm:h-[450px] sm:w-[450px]" />
        <div className="relative mx-auto w-full max-w-[1200px]">
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
          <div>
            <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-semibold tracking-[-.04em]">Galería de La Central</h2>
          </div>
          {gallery.images.length > 1 ? (
            <div className="flex gap-2">
              <button type="button" aria-label="Foto anterior" disabled={index === 0} onClick={() => swiper?.slidePrev()} className="lcb-gallery-arrow" title="Foto anterior"><ChevronLeft size={19} strokeWidth={2} /></button>
              <button type="button" aria-label="Foto siguiente" disabled={index >= gallery.images.length - (swiper?.slidesPerViewDynamic() ?? 1)} onClick={() => swiper?.slideNext()} className="lcb-gallery-arrow" title="Foto siguiente"><ChevronRight size={19} strokeWidth={2} /></button>
            </div>
          ) : null}
        </div>
        <Swiper modules={[A11y]} slidesPerView={1.16} spaceBetween={12}
          breakpoints={{ 640: { slidesPerView: 2.1, spaceBetween: 14 }, 1024: { slidesPerView: 3, spaceBetween: 16 } }}
          onSwiper={setSwiper}
          onSlideChange={s => setIndex(s.activeIndex)}
          onResize={s => setIndex(s.activeIndex)}
          className="lcb-food-swiper !overflow-hidden">
          {gallery.images.map((image, imageIndex) => (
            <SwiperSlide key={image.id}>
              <button type="button"
                onClick={() => setSelectedImageIndex(imageIndex)}
                aria-label={`Ampliar fotografía ${imageIndex + 1} de ${gallery.images.length}`}
                title="Ver fotografía en pantalla completa"
                className="group relative block h-[205px] w-full cursor-zoom-in overflow-hidden rounded-[17px] border border-white/10 bg-[#1d1d1d] text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-central-orange sm:h-[255px] lg:h-[275px]">
                <img loading="lazy" src={image.image_url} alt={image.alt_text || 'Fotografía de La Central Burger'} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <span aria-hidden="true" className="lcb-gallery-expand-icon absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/65 shadow-sm backdrop-blur-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>
                </span>
              </button>
            </SwiperSlide>
          ))}
        </Swiper>
        </div>
      </section>
      {selectedImageIndex !== null ? (
        <GalleryLightbox
          images={gallery.images}
          selectedIndex={selectedImageIndex}
          onSelect={setSelectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
        />
      ) : null}
    </>
  );
}
