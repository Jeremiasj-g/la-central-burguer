'use client';

import { Maximize2, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product } from '../types/producto.types';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/ui/Modal';
import { Textarea } from '@/shared/components/ui/Textarea';
import { formatCurrency } from '@/shared/utils/format.utils';
import { cn } from '@/shared/utils/cn';
import { ProductImageMedia } from './ProductImageMedia';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (payload: { product: Product; quantity: number; note?: string }) => void;
  disabled?: boolean;
  onPreviewImage?: (product: Product) => void;
  categoryName?: string;
}

export function ProductDetailModal({ product, open, onClose, onAddToCart, disabled = false, onPreviewImage, categoryName }: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [withNote, setWithNote] = useState(false);
  const [note, setNote] = useState('');
  const [displayProduct, setDisplayProduct] = useState<Product | null>(product);

  useEffect(() => {
    if (product) setDisplayProduct(product);
  }, [product]);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setWithNote(false);
    setNote('');
  }, [open, product?.id]);

  if (!displayProduct) return null;
  const currentProduct = displayProduct;

  function handleAdd() {
    if (disabled) return;
    onAddToCart({ product: currentProduct, quantity, note: withNote && note.trim() ? note.trim() : undefined });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentProduct.name}
      theme="dark"
      size="lg"
      panelClassName="border-central-orange/30 bg-[#171514] text-central-cream"
    >
      <div className="grid gap-4 md:grid-cols-[240px_1fr] md:gap-6">
        <button
          type="button"
          className="group/image relative h-[24dvh] min-h-[160px] max-h-[210px] overflow-hidden rounded-sm border border-central-orange/25 bg-black text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange md:h-full md:max-h-none"
          onClick={() => onPreviewImage?.(currentProduct)}
          title={`Ampliar imagen de ${currentProduct.name}`}
          aria-label={`Ampliar imagen de ${currentProduct.name}`}
        >
          <ProductImageMedia
            imageUrl={currentProduct.imageUrl}
            productName={currentProduct.name}
            categoryName={categoryName}
            className="h-full w-full"
            imageClassName="transition duration-300 group-hover/image:scale-[1.02]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent p-3 md:p-4">
            <p className="font-display text-2xl uppercase tracking-wide text-central-orange md:text-3xl">{formatCurrency(currentProduct.currentPrice)}</p>
          </div>
          {onPreviewImage ? (
            <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-sm border border-white/20 bg-black/70 text-central-cream backdrop-blur transition group-hover/image:border-central-orange group-hover/image:bg-central-orange group-hover/image:text-black">
              <Maximize2 size={15} />
            </span>
          ) : null}
        </button>

        <div className="min-w-0">
          <p className="text-sm font-semibold leading-6 text-central-cream/72 md:text-base md:leading-7">{currentProduct.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-sm border border-central-orange/20 bg-black/30 p-3">
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-central-orange/80">Cantidad</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-central-orange/25 text-central-cream/75 transition hover:bg-central-orange hover:text-black"
                  onClick={() => setQuantity((value) => Math.max(value - 1, 1))}
                  aria-label="Disminuir cantidad"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-7 text-center font-display text-2xl text-central-cream">{quantity}</span>
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-central-orange/25 text-central-cream/75 transition hover:bg-central-orange hover:text-black"
                  onClick={() => setQuantity((value) => value + 1)}
                  aria-label="Aumentar cantidad"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="rounded-sm border border-central-orange/20 bg-black/30 p-3">
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-central-orange/80">Aclaración</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className={cn('flex cursor-pointer items-center justify-center gap-1.5 rounded-sm border px-2 py-2 text-xs font-bold transition', !withNote ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 text-central-cream/60')}>
                  <input checked={!withNote} onChange={() => setWithNote(false)} type="radio" className="accent-central-orange" /> No
                </label>
                <label className={cn('flex cursor-pointer items-center justify-center gap-1.5 rounded-sm border px-2 py-2 text-xs font-bold transition', withNote ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 text-central-cream/60')}>
                  <input checked={withNote} onChange={() => setWithNote(true)} type="radio" className="accent-central-orange" /> Sí
                </label>
              </div>
            </div>
          </div>

          {withNote ? (
            <Textarea
              className="mt-3 min-h-20 border-central-orange/20 bg-[#11100f] py-2 text-central-cream placeholder:text-central-cream/35"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej: sin cebolla, poco queso, sin tomate..."
            />
          ) : null}

          <div className="mt-4 border-t border-dashed border-central-orange/35 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-display text-2xl uppercase tracking-wide md:text-3xl">Total</span>
              <span className="font-display text-3xl text-central-orange md:text-4xl">{formatCurrency(currentProduct.currentPrice * quantity)}</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex sm:justify-end">
              <Button size="sm" variant="ghost" className="px-3 text-central-cream hover:bg-white/10" onClick={onClose}>Cancelar</Button>
              <Button
                size="sm"
                className="min-w-0 bg-central-orange px-3 text-black hover:bg-central-cream disabled:cursor-not-allowed sm:h-11 sm:px-5"
                title={disabled ? 'Local cerrado, intente más tarde' : 'Agregar al carrito'}
                disabled={disabled}
                onClick={handleAdd}
              >
                {disabled ? 'Local cerrado' : 'Agregar al carrito'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
