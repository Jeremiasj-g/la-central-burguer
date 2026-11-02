import { Ban, Maximize2, Plus, Star } from 'lucide-react';
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

  function selectProduct() {
    if (blocked) {
      toast.warning(unavailable ? 'Este producto no está disponible por el momento.' : 'Local cerrado, intentá más tarde.');
      return;
    }
    onSelect(product);
  }

  return (
    <article className={cn(
      'chet-product-card group relative flex min-w-0 flex-col overflow-hidden rounded-[23px] border border-white/10 bg-[#1b1b1e] transition-transform duration-200 hover:scale-[1.018] motion-reduce:transition-none',
      blocked && 'opacity-65 hover:scale-100',
    )}>
      <button type="button" className={cn('absolute inset-0 z-20 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#ff933d]', blocked ? 'cursor-not-allowed' : 'cursor-pointer')}
        onClick={selectProduct} title={unavailable ? 'Producto no disponible' : disabled ? 'Local cerrado, intentá más tarde' : 'Ver ' + product.name}
        aria-label={unavailable ? 'Producto no disponible' : disabled ? 'Local cerrado, intentá más tarde' : 'Ver ' + product.name} />

      <div className="relative aspect-[1.55] w-full overflow-hidden bg-[#242327] sm:aspect-[1.6]">
        <ProductImageMedia imageUrl={product.imageUrl} productName={product.name} categoryName={categoryName}
          className="h-full w-full" imageClassName="object-cover" />
        {product.featured && !unavailable ? (
          <span className="pointer-events-none absolute left-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-[#171719]/85 px-3 py-1.5 text-[11px] font-medium text-[#ffc08e] backdrop-blur-md">
            <Star size={12} strokeWidth={1.7}/> Favorito
          </span>
        ) : null}
        {blocked ? (
          <span className="pointer-events-none absolute right-4 top-4 z-30 rounded-full border border-white/15 bg-[#161619]/85 px-3 py-1.5 text-[11px] font-medium text-white/75">
            <Ban size={12} className="mr-1 inline" /> {unavailable ? 'No disponible' : 'Local cerrado'}
          </span>
        ) : null}
        {onPreviewImage && !unavailable ? (
          <button type="button" aria-label={'Ampliar foto de ' + product.name} title="Ver imagen completa" onClick={() => onPreviewImage(product)}
            className="absolute bottom-3 right-3 z-40 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-[#141416]/80 text-white/90 backdrop-blur-sm transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#ff933d] motion-reduce:transition-none">
            <Maximize2 size={16} strokeWidth={1.7} />
          </button>
        ) : null}
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-5 pt-4">
        <p className="truncate text-[11px] font-medium tracking-[.04em] text-[#ffac75]">{categoryName || 'Chetos'}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-[24px] text-lg font-semibold leading-[1.22] tracking-[-.03em] text-white">{product.name}</h3>
        <p className="mt-2 line-clamp-2 min-h-[40px] text-[13px] font-normal leading-5 text-white/55">{product.description || 'Preparado para disfrutar.'}</p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="min-w-0">
            {product.discountPercent && product.originalPrice !== undefined ? (
              <p className="text-[12px] font-normal text-white/40 line-through">{formatCurrency(product.originalPrice)}</p>
            ) : null}
            <p className="text-xl font-semibold tracking-[-.04em] text-white">{formatCurrency(product.currentPrice)}</p>
          </div>
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ff933d] text-[#16100d]">
            <Plus size={21} strokeWidth={1.9} />
          </span>
        </div>
      </div>
    </article>
  );
}
