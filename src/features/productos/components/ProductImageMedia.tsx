'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { isProductImagePlaceholder } from '../utils/productImage.utils';

interface ProductImageMediaProps {
  imageUrl?: string | null;
  productName: string;
  categoryName?: string;
  className?: string;
  imageClassName?: string;
  fit?: 'cover' | 'contain';
  compact?: boolean;
}

export function ProductImageMedia({
  imageUrl,
  productName,
  categoryName,
  className,
  imageClassName,
  fit = 'cover',
  compact = false,
}: ProductImageMediaProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const showPlaceholder = failed || isProductImagePlaceholder(imageUrl);
  const placeholderLabel = categoryName?.trim() || 'Producto';

  return (
    <div className={cn('relative overflow-hidden bg-[#11100f]', className)}>
      {showPlaceholder ? (
        <div
          className={cn(
            'relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_75%_18%,rgba(255,255,255,.10),transparent_31%),linear-gradient(145deg,#1a1918_0%,#0c0b0a_68%,#050505_100%)] text-center',
            compact ? 'px-1' : 'px-3',
          )}
          role="img"
          aria-label={`Imagen de referencia para la categoría ${placeholderLabel}`}
        >
          <div className="pointer-events-none absolute -right-[11%] -top-[18%] h-[58%] w-[58%] rounded-full bg-white/[.055]" />
          <div className="pointer-events-none absolute -bottom-[28%] -left-[14%] h-[58%] w-[58%] rounded-full bg-black/45" />
          <div className="relative z-10 min-w-0 max-w-full">
            <p className={cn(
              'line-clamp-2 break-words font-black uppercase leading-tight tracking-wide text-central-cream/72',
              compact ? 'text-[6px]' : 'text-sm sm:text-base',
            )}>
              {placeholderLabel}
            </p>
            <p className={cn(
              'font-bold tracking-wide text-central-cream/36',
              compact ? 'mt-0.5 text-[4px]' : 'mt-1 text-[7px] sm:text-[8px]',
            )}>
              La Central Burger
            </p>
          </div>
        </div>
      ) : (
        <img
          src={imageUrl ?? ''}
          alt={productName}
          className={cn(
            'h-full w-full',
            fit === 'contain' ? 'object-contain' : 'object-cover',
            imageClassName,
          )}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
