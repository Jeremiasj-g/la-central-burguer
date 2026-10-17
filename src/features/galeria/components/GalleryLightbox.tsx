'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import type { GalleryImage } from '../services/gallery.service';

type GalleryLightboxProps = {
  images: GalleryImage[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
};

type Point = { x: number; y: number };

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;

function distance(a: React.Touch, b: React.Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function midpoint(a: React.Touch, b: React.Touch): Point {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export function GalleryLightbox({ images, selectedIndex, onSelect, onClose }: GalleryLightboxProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastTapAt = useRef(0);
  const gesture = useRef({
    mode: 'idle' as 'idle' | 'pinch' | 'pan' | 'swipe',
    distance: 1,
    scale: 1,
    start: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
  });
  const image = images[selectedIndex];

  useBodyScrollLock(true);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    setScale(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    gesture.current.mode = 'idle';
  }, [selectedIndex]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      else if (event.key === 'ArrowLeft' && selectedIndex > 0) { event.preventDefault(); onSelect(selectedIndex - 1); }
      else if (event.key === 'ArrowRight' && selectedIndex < images.length - 1) { event.preventDefault(); onSelect(selectedIndex + 1); }
      else if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        if (!buttons.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [selectedIndex, images.length, onClose, onSelect]);

  function clamp(next: Point, newScale: number): Point {
    const node = viewportRef.current;
    if (!node || newScale <= 1) return { x: 0, y: 0 };
    const x = node.clientWidth * (newScale - 1) / 2;
    const y = node.clientHeight * (newScale - 1) / 2;
    return {
      x: Math.max(-x, Math.min(x, next.x)),
      y: Math.max(-y, Math.min(y, next.y)),
    };
  }

  function changeZoom(amount: number) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((scale + amount) * 100) / 100));
    setScale(next);
    setOffset(current => clamp(current, next));
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      event.preventDefault();
      const a = event.touches[0], b = event.touches[1];
      gesture.current = {
        mode: 'pinch',
        distance: distance(a, b),
        scale,
        start: midpoint(a, b),
        offset,
      };
    } else if (event.touches.length === 1) {
      const p = event.touches[0];
      gesture.current = {
        mode: scale > 1 ? 'pan' : 'swipe',
        distance: 1,
        scale,
        start: { x: p.clientX, y: p.clientY },
        offset,
      };
    }
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (event.touches.length === 2 && start.mode === 'pinch') {
      event.preventDefault();
      const a = event.touches[0], b = event.touches[1];
      const middle = midpoint(a, b);
      const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, start.scale * distance(a, b) / Math.max(1, start.distance)));
      setScale(nextScale);
      setOffset(clamp({
        x: start.offset.x + middle.x - start.start.x,
        y: start.offset.y + middle.y - start.start.y,
      }, nextScale));
    } else if (event.touches.length === 1 && start.mode === 'pan') {
      event.preventDefault();
      const p = event.touches[0];
      setOffset(clamp({
        x: start.offset.x + p.clientX - start.start.x,
        y: start.offset.y + p.clientY - start.start.y,
      }, scale));
    }
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 1 && scale > 1) {
      const p = event.touches[0];
      gesture.current = {
        ...gesture.current, mode: 'pan',
        start: { x: p.clientX, y: p.clientY },
        offset,
      };
      return;
    }
    if (event.touches.length === 0 && gesture.current.mode === 'swipe' && event.changedTouches.length) {
      const p = event.changedTouches[0];
      const dx = p.clientX - gesture.current.start.x;
      const dy = p.clientY - gesture.current.start.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        const nextIndex = selectedIndex + (dx < 0 ? 1 : -1);
        if (nextIndex >= 0 && nextIndex < images.length) onSelect(nextIndex);
      } else if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        const now = Date.now();
        if (now - lastTapAt.current < 300) changeZoom(scale > 1 ? -scale + 1 : 1);
        lastTapAt.current = now;
      }
    }
    gesture.current.mode = 'idle';
    if (scale < 1.02) { setScale(1); setOffset({ x: 0, y: 0 }); }
  }

  if (!image || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Fotografía ampliada"
      className="lcb-gallery-lightbox fixed inset-0 z-[160] flex flex-col overflow-hidden text-white"
      style={{ backgroundColor: 'rgba(9,9,11,.97)', color: '#fff' }}>
      <div className="relative z-10 flex h-[64px] shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 sm:h-[72px] sm:px-6">
        <span className="text-[13px] font-medium text-white/80">{selectedIndex + 1} de {images.length}</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar fotografía" title="Cerrar"
          className="lcb-gallery-viewer-control h-10 w-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"><X size={21} /></button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={viewportRef} className="absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden p-3 sm:p-8"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
          onDoubleClick={() => changeZoom(scale > 1 ? 1 - scale : 1)}>
          <img src={image.image_url} alt={image.alt_text || 'Fotografía de La Central Burger'}
            draggable={false} className="pointer-events-none block max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transformOrigin: 'center center',
            }} />
        </div>
        {images.length > 1 ? (
          <>
            <button type="button" aria-label="Fotografía anterior" onClick={() => onSelect(selectedIndex - 1)}
              disabled={selectedIndex === 0}
              className="lcb-gallery-viewer-control absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 sm:left-5 sm:h-12 sm:w-12"><ChevronLeft size={22}/></button>
            <button type="button" aria-label="Fotografía siguiente" onClick={() => onSelect(selectedIndex + 1)}
              disabled={selectedIndex === images.length - 1}
              className="lcb-gallery-viewer-control absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 sm:right-5 sm:h-12 sm:w-12"><ChevronRight size={22}/></button>
          </>
        ) : null}
      </div>
      <div className="relative z-10 flex min-h-[76px] shrink-0 flex-col items-center justify-center gap-2 border-t border-white/10 px-4 pb-[env(safe-area-inset-bottom)] sm:min-h-[88px]">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Alejar fotografía" disabled={scale <= MIN_ZOOM}
            onClick={() => changeZoom(-0.5)} className="lcb-gallery-viewer-control h-10 w-10"><ZoomOut size={19}/></button>
          <span aria-live="polite" className="w-14 text-center text-[12px] text-white/80">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Acercar fotografía" disabled={scale >= MAX_ZOOM}
            onClick={() => changeZoom(0.5)} className="lcb-gallery-viewer-control h-10 w-10"><ZoomIn size={19}/></button>
        </div>
        <p className="text-center text-[10px] text-white/50 sm:text-[11px]">Separá dos dedos para ampliar · Deslizá para cambiar de foto</p>
      </div>
    </div>, document.body,
  );
}
