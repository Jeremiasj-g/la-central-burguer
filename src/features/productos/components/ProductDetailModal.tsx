'use client';

import { Check, Maximize2, MessageSquareText, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product } from '../types/producto.types';
import { Modal } from '@/shared/components/ui/Modal';
import { Textarea } from '@/shared/components/ui/Textarea';
import { formatCurrency } from '@/shared/utils/format.utils';
import { cn } from '@/shared/utils/cn';
import { formatMenuLabel } from '@/features/catalogo/utils/menuLabel';
import { ProductImageMedia } from './ProductImageMedia';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (payload: { product: Product; quantity: number; note?: string }) => Promise<boolean>;
  disabled?: boolean;
  onPreviewImage?: (product: Product) => void;
  categoryName?: string;
}

export function ProductDetailModal({
  product, open, onClose, onAddToCart, disabled = false, onPreviewImage, categoryName,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [withNote, setWithNote] = useState(false);
  const [note, setNote] = useState('');
  // Conservar el producto mientras la animación de salida termina.
  const [displayProduct, setDisplayProduct] = useState<Product | null>(product);

  useEffect(() => {
    if (product) setDisplayProduct(product);
  }, [product]);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setIsAdding(false);
    setWithNote(false);
    setNote('');
  }, [open, product?.id]);

  if (!displayProduct) return null;
  const currentProduct = displayProduct;
  const unavailable = !currentProduct.available;
  const blocked = disabled || unavailable;
  const total = currentProduct.currentPrice * quantity;

  async function handleAdd() {
    if (blocked || isAdding) return;
    setIsAdding(true);
    try {
      const added = await onAddToCart({
        product: currentProduct,
        quantity,
        note: withNote && note.trim() ? note.trim() : undefined,
      });
      if (added) onClose();
    } finally {
      setIsAdding(false);
    }
  }

  const image = (
    <>
      <ProductImageMedia
        imageUrl={currentProduct.imageUrl}
        productName={currentProduct.name}
        categoryName={categoryName}
        className="h-full w-full"
        imageClassName="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover/image:scale-[1.025]"
      />
      {onPreviewImage ? (
        <span className="lcb-detail-expand pointer-events-none absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-[11px] bg-[#191b20]/80 text-white backdrop-blur-md sm:bottom-4 sm:right-4">
          <Maximize2 size={16} strokeWidth={1.75} />
        </span>
      ) : null}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentProduct.name}
      theme="dark"
      size="lg"
      panelClassName="lcb-product-detail !rounded-[22px] !border-white/10 !bg-[#191b20] !text-[#f5f4f2] !shadow-[0_25px_85px_rgba(0,0,0,.35)]"
    >
      <div className="lcb-product-detail-content grid min-w-0 gap-5 sm:gap-6 md:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] md:items-start md:gap-7">
        <div className="min-w-0">
          {onPreviewImage ? (
            <button
              type="button"
              onClick={() => onPreviewImage(currentProduct)}
              className="group/image relative block aspect-[1.7] w-full overflow-hidden rounded-[16px] bg-[#24262b] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange md:aspect-[.95]"
              title="Ampliar fotografía"
              aria-label={'Ampliar fotografía de ' + currentProduct.name}
            >
              {image}
            </button>
          ) : (
            <div className="relative aspect-[1.7] w-full overflow-hidden rounded-[16px] bg-[#24262b] md:aspect-[.95]">
              {image}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5 md:gap-6">
          <div className="min-w-0">
            {categoryName ? (
              <p className="text-[11px] font-medium text-[#efae58]">{formatMenuLabel(categoryName)}</p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[12px] font-normal text-white/50">Precio unitario</p>
              <p className="text-[22px] font-semibold tracking-[-.04em] text-[#faf9f6] tabular-nums">
                {formatCurrency(currentProduct.currentPrice)}
              </p>
            </div>
            {currentProduct.description ? (
              <p className="mt-3 text-[13px] font-normal leading-[1.7] text-white/60 sm:text-[14px]">
                {currentProduct.description}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 items-center justify-between gap-4 border-t border-white/10 pt-4">
            <div>
              <p className="text-[13px] font-medium text-white/90">Cantidad</p>
              <p className="mt-0.5 text-[11px] text-white/45">¿Cuántos querés?</p>
            </div>
            <div className="lcb-detail-stepper flex h-11 shrink-0 items-center gap-1 rounded-[12px] bg-white/[.06] p-1">
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-[9px] text-white/75 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1 || isAdding}
                aria-label="Disminuir cantidad"
              >
                <Minus size={17} strokeWidth={1.9} />
              </button>
              <output className="min-w-8 text-center text-[16px] font-semibold tabular-nums text-white" aria-live="polite">
                {quantity}
              </output>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-[9px] text-white/75 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                onClick={() => setQuantity((value) => value + 1)}
                disabled={isAdding}
                aria-label="Aumentar cantidad"
              >
                <Plus size={17} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <MessageSquareText size={17} strokeWidth={1.65} className="shrink-0 text-white/45" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white/90">Aclaración</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/45">Opcional, para preparar tu pedido</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={withNote}
                aria-label="Agregar aclaración al producto"
                onClick={() => setWithNote((value) => !value)}
                disabled={isAdding}
                className={cn(
                  'relative h-7 w-[47px] shrink-0 rounded-full border transition-[background-color,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange disabled:opacity-60',
                  withNote ? 'border-central-orange bg-central-orange' : 'border-white/15 bg-white/10',
                )}
              >
                <span className={cn(
                  'absolute left-[3px] top-[3px] grid h-[20px] w-[20px] place-items-center rounded-full bg-white text-black/70 shadow-sm transition-transform duration-200 motion-reduce:transition-none',
                  withNote ? 'translate-x-[19px]' : 'translate-x-0',
                )}>
                  {withNote ? <Check size={12} strokeWidth={2.2} /> : null}
                </span>
              </button>
            </div>
            <div
              aria-hidden={!withNote}
              className={cn(
                'grid transition-[grid-template-rows,opacity,margin-top] duration-200 ease-out motion-reduce:transition-none',
                withNote ? 'mt-3 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0 pointer-events-none',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <Textarea
                  className="!min-h-[88px] !w-full !rounded-[12px] !border-white/10 !bg-white/[.055] !px-3.5 !py-3 !text-[13px] !font-normal !leading-6 !text-white placeholder:!text-white/35 focus:!border-central-orange/60"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ej.: sin cebolla, poco queso, sin tomate..."
                  tabIndex={withNote ? 0 : -1}
                  disabled={isAdding}
                />
              </div>
            </div>
          </div>

          <div className="lcb-detail-summary sticky bottom-[-1px] z-10 -mx-3.5 border-t border-white/10 bg-[#191b20] px-3.5 pb-1 pt-4 sm:-mx-5 sm:px-5 md:static md:mx-0 md:px-0 md:pb-0">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-white/60">Total</span>
              <span className="text-[26px] font-semibold tracking-[-.045em] text-white tabular-nums" aria-live="polite">
                {formatCurrency(total)}
              </span>
            </div>
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[13px] bg-central-orange px-4 text-[13px] font-semibold text-[#191b20] shadow-none transition-[background-color,transform,opacity] duration-200 hover:bg-[#ffc04a] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
              title={unavailable ? 'Producto no disponible' : disabled ? 'Local cerrado, intentá más tarde' : 'Agregar al carrito'}
              disabled={blocked || isAdding}
              onClick={() => void handleAdd()}
            >
              <ShoppingBag size={17} strokeWidth={1.9} />
              {unavailable ? 'No disponible' : disabled ? 'Local cerrado' : isAdding ? 'Verificando...' : 'Agregar al carrito'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
