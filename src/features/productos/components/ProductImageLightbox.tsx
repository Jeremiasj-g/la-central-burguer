'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { ProductImageMedia } from './ProductImageMedia';

interface ProductImageLightboxProps {
  open: boolean;
  imageUrl: string;
  productName: string;
  categoryName?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function getDistance(first: React.Touch, second: React.Touch) {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function getMidpoint(first: React.Touch, second: React.Touch) {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

export function ProductImageLightbox({ open, imageUrl, productName, categoryName, onClose }: ProductImageLightboxProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gestureRef = useRef({
    mode: 'idle' as 'idle' | 'pinch' | 'pan',
    startDistance: 0,
    startScale: MIN_SCALE,
    startMidpoint: { x: 0, y: 0 },
    startPointer: { x: 0, y: 0 },
    startOffset: { x: 0, y: 0 },
  });

  useEffect(() => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
    gestureRef.current.mode = 'idle';
  }, [open, imageUrl]);

  function clampOffset(nextOffset: { x: number; y: number }, nextScale: number) {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds || nextScale <= MIN_SCALE) return { x: 0, y: 0 };

    const maxX = (bounds.width * (nextScale - MIN_SCALE)) / 2;
    const maxY = (bounds.height * (nextScale - MIN_SCALE)) / 2;

    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y)),
    };
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      event.preventDefault();
      const first = event.touches[0];
      const second = event.touches[1];

      gestureRef.current = {
        mode: 'pinch',
        startDistance: getDistance(first, second),
        startScale: scale,
        startMidpoint: getMidpoint(first, second),
        startPointer: { x: 0, y: 0 },
        startOffset: offset,
      };
      return;
    }

    if (event.touches.length === 1 && scale > MIN_SCALE) {
      event.preventDefault();
      const touch = event.touches[0];
      gestureRef.current = {
        ...gestureRef.current,
        mode: 'pan',
        startPointer: { x: touch.clientX, y: touch.clientY },
        startOffset: offset,
      };
    }
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2 && gestureRef.current.mode === 'pinch') {
      event.preventDefault();
      const first = event.touches[0];
      const second = event.touches[1];
      const distance = getDistance(first, second);
      const midpoint = getMidpoint(first, second);
      const ratio = gestureRef.current.startDistance > 0 ? distance / gestureRef.current.startDistance : 1;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, gestureRef.current.startScale * ratio));
      const nextOffset = clampOffset({
        x: gestureRef.current.startOffset.x + midpoint.x - gestureRef.current.startMidpoint.x,
        y: gestureRef.current.startOffset.y + midpoint.y - gestureRef.current.startMidpoint.y,
      }, nextScale);

      setScale(nextScale);
      setOffset(nextOffset);
      return;
    }

    if (event.touches.length === 1 && scale > MIN_SCALE && gestureRef.current.mode === 'pan') {
      event.preventDefault();
      const touch = event.touches[0];
      setOffset(clampOffset({
        x: gestureRef.current.startOffset.x + touch.clientX - gestureRef.current.startPointer.x,
        y: gestureRef.current.startOffset.y + touch.clientY - gestureRef.current.startPointer.y,
      }, scale));
    }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 1 && scale > MIN_SCALE) {
      const touch = event.touches[0];
      gestureRef.current = {
        ...gestureRef.current,
        mode: 'pan',
        startPointer: { x: touch.clientX, y: touch.clientY },
        startOffset: offset,
      };
      return;
    }

    gestureRef.current.mode = 'idle';
    if (scale <= 1.02) {
      setScale(MIN_SCALE);
      setOffset({ x: 0, y: 0 });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={productName}
      theme="dark"
      size="xl"
      panelClassName="border-central-orange/30 bg-[#11100f] text-central-cream"
    >
      <div
        ref={viewportRef}
        className="flex h-[320px] max-h-[58dvh] w-full items-center justify-center overflow-hidden rounded-sm border border-central-orange/20 bg-black p-1.5 sm:h-[520px] sm:max-h-[64dvh] sm:p-2"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className="h-full w-full origin-center will-change-transform"
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
        >
          <ProductImageMedia
            imageUrl={imageUrl}
            productName={productName}
            categoryName={categoryName}
            fit="contain"
            className="h-full w-full"
            imageClassName="pointer-events-none select-none"
          />
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-medium text-central-cream/45 sm:text-xs">
        Separá dos dedos para acercar. Con zoom, arrastrá para recorrer la imagen.
      </p>
    </Modal>
  );
}
