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
  return (
    <article className={cn(
      'group relative min-h-[136px] overflow-hidden rounded-sm border border-central-orange/18 bg-[#171514] shadow-dark transition duration-300',
      disabled ? 'opacity-70' : 'hover:-translate-y-1 hover:border-central-orange/65 hover:shadow-orange',
    )}>
      <button
        type="button"
        className={cn('absolute inset-0 z-20', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        onClick={() => {
          if (disabled) {
            toast.warning('Local cerrado, intente más tarde.');
            return;
          }
          onSelect(product);
        }}
        title={disabled ? 'Local cerrado, intente más tarde' : `Ver ${product.name}`}
        aria-label={disabled ? 'Local cerrado, intente más tarde' : `Ver ${product.name}`}
      />

      {disabled ? (
        <div className="pointer-events-none absolute right-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-sm border border-red-400/40 bg-black/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-300">
          <Ban size={12} /> Local cerrado
        </div>
      ) : null}

      <div className="absolute inset-y-0 right-0 w-[40%] overflow-hidden bg-black sm:w-[38%]">
        <ProductImageMedia
          imageUrl={product.imageUrl}
          productName={product.name}
          categoryName={categoryName}
          className="h-full w-full"
          imageClassName="transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#171514] via-[#171514]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-transparent" />
      </div>

      {onPreviewImage ? (
        <button
          type="button"
          className="absolute bottom-2.5 right-2.5 z-40 grid h-8 w-8 place-items-center rounded-sm border border-central-orange/35 bg-black/75 text-central-cream/80 backdrop-blur transition hover:border-central-orange hover:bg-central-orange hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange"
          onClick={() => onPreviewImage(product)}
          title={`Ampliar imagen de ${product.name}`}
          aria-label={`Ampliar imagen de ${product.name}`}
        >
          <Maximize2 size={15} />
        </button>
      ) : null}

      <div className="relative z-10 flex min-h-[136px] max-w-[72%] flex-col justify-between p-4 pr-2 sm:max-w-[68%]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {categoryName ? <span className="text-[10px] font-black uppercase tracking-[.22em] text-central-orange/75">{categoryName}</span> : null}
            {product.featured ? <span className="inline-flex items-center gap-1 rounded-full border border-central-orange/35 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-central-orange"><Star size={11} /> recomendado</span> : null}
          </div>
          <h3 className="mt-1.5 line-clamp-2 font-black text-base leading-tight text-central-cream sm:text-xl">{product.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs sm:text-sm font-medium leading-5 text-central-cream/62">{product.description}</p>
        </div>

        <div className="mt-3 flex items-end sm:mt-4 justify-between gap-3">
          <p className="font-black text-central-orange">{formatCurrency(product.currentPrice)}</p>
        </div>
      </div>
    </article>
  );
}
