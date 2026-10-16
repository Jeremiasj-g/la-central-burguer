import { ArrowUpRight, Ban, Maximize2, Star } from 'lucide-react';
import { toast } from 'react-toastify';
import type { Product } from '../types/producto.types';
import { formatCurrency } from '@/shared/utils/format.utils';
import { ProductImageMedia } from './ProductImageMedia';

interface ProductoCardProps {
  product: Product;
  categoryName?: string;
  disabled?: boolean;
  onSelect: (product: Product) => void;
  onPreviewImage?: (product: Product) => void;
}

export function ProductoCard({ product, categoryName, disabled = false, onSelect, onPreviewImage }: ProductoCardProps) {
  const unavailable = !product.available;
  const blocked = disabled || unavailable;

  return (
    <article className={`lcb-menu-product group relative flex min-w-0 flex-col overflow-hidden ${blocked ? 'is-unavailable' : ''}`}>
      <div className="relative aspect-[1.33] min-w-0 overflow-hidden bg-[var(--lcb-image-bg)]">
        <ProductImageMedia imageUrl={product.imageUrl} productName={product.name}
          categoryName={categoryName} className="h-full w-full"
          imageClassName="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.035]"/>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"/>
        {unavailable ? (
          <span className="lcb-product-state absolute left-3 top-3 z-30 inline-flex items-center gap-1.5">
            <Ban size={12} strokeWidth={1.8}/> No disponible
          </span>
        ) : product.featured ? (
          <span className="lcb-product-featured absolute left-3 top-3 z-30 inline-flex items-center gap-1.5">
            <Star size={12} strokeWidth={1.8} fill="currentColor"/> Recomendado
          </span>
        ) : null}
        {onPreviewImage && !unavailable && (
          <button type="button" className="lcb-product-zoom absolute bottom-3 right-3 z-40"
            onClick={() => onPreviewImage(product)} aria-label={`Ampliar imagen de ${product.name}`}
            title={`Ampliar imagen de ${product.name}`}>
            <Maximize2 size={16} strokeWidth={1.7}/>
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--lcb-accent-text)]">{categoryName || 'La Central'}</p>
        <h3 className="mt-2 line-clamp-2 min-h-[44px] break-words text-[17px] font-semibold leading-[1.28] tracking-[-.035em] sm:text-[19px]">{product.name}</h3>
        <p className="mt-2 line-clamp-2 min-h-[38px] text-[12px] leading-[19px] text-[var(--lcb-muted)]">{product.description || 'Preparado especialmente para vos.'}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-5">
          <span className="whitespace-nowrap text-[17px] font-semibold tracking-[-.03em] tabular-nums sm:text-[19px]">{formatCurrency(product.currentPrice)}</span>
          <span className="lcb-product-arrow grid h-9 w-9 shrink-0 place-items-center rounded-[11px]" aria-hidden="true">
            {blocked ? <Ban size={15}/> : <ArrowUpRight size={17} strokeWidth={1.9}/>}
          </span>
        </div>
      </div>
      <button type="button" className={`absolute inset-0 z-20 ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => {
          if (blocked) {
            toast.warning(unavailable ? 'Este producto no está disponible por el momento.' : 'Local cerrado, intentá más tarde.');
            return;
          }
          onSelect(product);
        }}
        title={unavailable ? 'Producto no disponible' : disabled ? 'Local cerrado' : `Elegir ${product.name}`}
        aria-label={unavailable ? `${product.name}, no disponible` : disabled ? `${product.name}, local cerrado` : `Elegir ${product.name}`}/>
    </article>
  );
}
