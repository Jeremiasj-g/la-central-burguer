import { Ban, Maximize2, Star } from 'lucide-react';
import { toast } from 'react-toastify';
import type { Product } from '../types/producto.types';
import { formatCurrency } from '@/shared/utils/format.utils';
import { cn } from '@/shared/utils/cn';
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
    <article className={cn(
      'lcb-polished-product group relative min-h-[174px] overflow-hidden rounded-[18px] border transition-[transform,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none hover:-translate-y-[2px] sm:min-h-[188px]',
      blocked && 'opacity-70 hover:translate-y-0',
    )}>
      <button
        type="button"
        className={cn('absolute inset-0 z-20', blocked ? 'cursor-not-allowed' : 'cursor-pointer')}
        onClick={() => {
          if (blocked) {
            toast.warning(unavailable ? 'Este producto no está disponible por el momento.' : 'Local cerrado, intentá más tarde.');
            return;
          }
          onSelect(product);
        }}
        title={unavailable ? 'Producto no disponible' : disabled ? 'Local cerrado, intentá más tarde' : `Ver ${product.name}`}
        aria-label={unavailable ? 'Producto no disponible' : disabled ? 'Local cerrado, intentá más tarde' : `Ver ${product.name}`}
      />

      {unavailable ? (
        <span className="pointer-events-none absolute right-3 top-3 z-30 inline-flex items-center gap-1 rounded-[9px] border border-central-orange/25 bg-[#191b20]/90 px-2.5 py-1 text-[10px] font-medium text-[#f2b77e]">
          <Ban size={12} strokeWidth={1.8} /> No disponible
        </span>
      ) : disabled ? (
        <span className="pointer-events-none absolute right-3 top-3 z-30 inline-flex items-center gap-1 rounded-[9px] border border-white/15 bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white/70">
          <Ban size={12} strokeWidth={1.8} /> Local cerrado
        </span>
      ) : null}

      <div className="lcb-polished-product-media absolute inset-y-0 right-0 w-[41%] overflow-hidden sm:w-[40%]">
        <ProductImageMedia
          imageUrl={product.imageUrl}
          productName={product.name}
          categoryName={categoryName}
          className="h-full w-full"
          imageClassName=""
        />
        <div className="lcb-polished-product-gradient absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-transparent" />
      </div>

      {onPreviewImage && !unavailable ? (
        <button
          type="button"
          className="absolute bottom-2.5 right-2.5 z-40 grid h-9 w-9 place-items-center rounded-[11px] border border-central-orange/35 bg-black/75 text-central-cream/80 backdrop-blur transition hover:border-central-orange hover:bg-central-orange hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange"
          onClick={() => onPreviewImage(product)}
          title={`Ampliar imagen de ${product.name}`}
          aria-label={`Ampliar imagen de ${product.name}`}
        >
          <Maximize2 size={15} />
        </button>
      ) : null}

      <div className="relative z-10 flex min-h-[174px] max-w-[74%] flex-col justify-between p-4 pr-2 sm:min-h-[188px] sm:max-w-[70%] sm:p-5 sm:pr-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {categoryName ? <span className="lcb-polished-category-label text-[10px] font-semibold tracking-[.05em]">{categoryName}</span> : null}
            {product.featured ? <span className="lcb-polished-featured inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold"><Star size={11} /> recomendado</span> : null}
          </div>
          <h3 className="lcb-polished-product-title mt-2 line-clamp-2 text-[16px] font-semibold leading-[1.25] tracking-[-.025em] sm:text-[18px]">{product.name}</h3>
          <p className="lcb-polished-product-description mt-2 line-clamp-2 text-[12px] font-normal leading-5">{product.description}</p>
        </div>

        <div className="mt-3 flex items-end sm:mt-4 justify-between gap-3">
          <p className="lcb-polished-product-price text-[17px] font-semibold tracking-[-.025em] sm:text-[18px]">{formatCurrency(product.currentPrice)}</p>
        </div>
      </div>
    </article>
  );
}
