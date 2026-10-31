'use client';

import { Check, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types/carrito.types';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { formatCurrency } from '@/shared/utils/format.utils';
import { ProductImageMedia } from '@/features/productos/components/ProductImageMedia';
import { cn } from '@/shared/utils/cn';
import { usePublicTheme } from '@/shared/components/layout/PublicThemeProvider';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  forceRemoving?: boolean;
}

export function CartItemRow({ item, onUpdateQuantity, onUpdateNote, onRemove, forceRemoving = false }: CartItemRowProps) {
  const theme = usePublicTheme();
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(item.note ?? '');
  const [isRemoving, setIsRemoving] = useState(false);
  const removeTimerRef = useRef<number | null>(null);
  const removing = isRemoving || forceRemoving;
  const originalUnitPrice = item.originalUnitPrice ?? item.unitPrice;
  const hasDiscount = originalUnitPrice > item.unitPrice;

  useEffect(() => {
    if (!editingNote) setDraftNote(item.note ?? '');
  }, [item.note, editingNote]);

  useEffect(() => () => {
    if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current);
  }, []);

  function cancelNoteEdit() {
    setDraftNote(item.note ?? '');
    setEditingNote(false);
  }

  function saveNote() {
    onUpdateNote(item.id, draftNote.trim());
    setEditingNote(false);
  }

  function removeWithAnimation() {
    setConfirmRemoveOpen(false);
    setIsRemoving(true);
    removeTimerRef.current = window.setTimeout(() => onRemove(item.id), 200);
  }

  return (
    <article className={cn(
      'lcb-cart-item-row min-w-0 py-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
      removing ? 'pointer-events-none -translate-x-3 opacity-0' : 'translate-x-0 opacity-100',
    )}>
      <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)_32px] items-start gap-3">
        <ProductImageMedia
          imageUrl={item.imageUrl}
          productName={item.productName}
          categoryName={item.categoryName}
          compact
          className="h-16 w-16 shrink-0 rounded-[13px] bg-[#242424]"
        />

        <div className="min-w-0 pt-0.5">
          <h4 className="line-clamp-3 break-words text-[13px] font-semibold leading-[1.36] tracking-[-.012em] text-[#f6f5f2] sm:text-[14px]">
            {item.productName}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums">
            {hasDiscount ? (
              <span className="text-white/40 line-through">{formatCurrency(originalUnitPrice)} c/u</span>
            ) : null}
            <span className={hasDiscount ? 'font-medium text-[#f3b25b]' : 'font-normal text-white/45'}>
              {formatCurrency(item.unitPrice)} c/u
            </span>
            {hasDiscount && item.discountPercent ? (
              <span className="font-semibold text-[#f3b25b]">-{item.discountPercent}%</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-[10px] text-white/40 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
          title="Eliminar producto del pedido"
          aria-label={`Eliminar ${item.productName} del pedido`}
          onClick={() => setConfirmRemoveOpen(true)}
          disabled={removing}
        >
          <Trash2 size={16} strokeWidth={1.7} />
        </button>
      </div>

      {editingNote ? (
        <div className="mt-3 space-y-2 pl-0 sm:pl-[76px]">
          <label htmlFor={`note-${item.id}`} className="block text-[11px] font-medium text-white/65">Aclaración del producto</label>
          <div className="lcb-public-field-shell" data-field-theme={theme}>
          <textarea
            id={`note-${item.id}`}
            autoFocus
            rows={2}
            maxLength={180}
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelNoteEdit();
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') saveNote();
            }}
            placeholder="Ej.: sin cebolla, poco queso..."
            className={cn('lcb-public-field-input custom-scrollbar min-h-[80px] w-full resize-y rounded-[11px] border-0 bg-transparent px-3 py-2.5 text-[12px] leading-5 outline-none',
              theme === 'light' ? 'text-[#292d32] placeholder:text-[#7e858c]' : 'text-white placeholder:text-white/40')}
          />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelNoteEdit} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[11px] font-medium text-white/60 transition-colors duration-200 hover:bg-white/[.07] hover:text-white">
              <X size={14} /> Cancelar
            </button>
            <button type="button" onClick={saveNote} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-central-orange px-3 text-[11px] font-semibold text-[#171717] transition-colors duration-200 hover:bg-[#ffc04a]">
              <Check size={14} /> Guardar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2.5 flex w-full min-w-0 items-center gap-2 rounded-[9px] py-1 text-left text-[11px] leading-[1.5] text-white/45 transition-colors duration-200 hover:text-white/80"
          title={item.note ? 'Editar aclaración' : 'Agregar aclaración'}
          onClick={() => setEditingNote(true)}
          disabled={removing}
        >
          <Pencil size={13} strokeWidth={1.7} className="shrink-0 text-[#f0b45c]" />
          <span className={cn('min-w-0 flex-1 break-words', item.note && 'text-white/65')}>
            {item.note || 'Agregar aclaración'}
          </span>
        </button>
      )}

      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <div className="lcb-cart-quantity-control inline-flex h-10 shrink-0 items-center gap-1 rounded-[12px] bg-white/[.055] p-1">
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            disabled={item.quantity <= 1 || removing}
            title="Disminuir cantidad"
            aria-label={`Disminuir cantidad de ${item.productName}`}
            className="grid h-8 w-8 place-items-center rounded-[9px] text-white/75 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Minus size={16} strokeWidth={1.8} />
          </button>
          <output className="min-w-7 text-center text-[14px] font-semibold tabular-nums text-white" aria-live="polite">
            {item.quantity}
          </output>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            disabled={removing}
            title="Aumentar cantidad"
            aria-label={`Aumentar cantidad de ${item.productName}`}
            className="grid h-8 w-8 place-items-center rounded-[9px] text-white/75 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus size={16} strokeWidth={1.8} />
          </button>
        </div>
        <div className="min-w-0 text-right tabular-nums">
          {hasDiscount ? (
            <p className="text-[11px] font-normal text-white/40 line-through">
              {formatCurrency(originalUnitPrice * item.quantity)}
            </p>
          ) : null}
          <p className="text-[16px] font-semibold tracking-[-.035em] text-[#f7f5f2] sm:text-[17px]">
            {formatCurrency(item.unitPrice * item.quantity)}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemoveOpen}
        theme={theme}
        title="Eliminar del pedido"
        description={`¿Seguro que querés quitar ${item.productName} del pedido?`}
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setConfirmRemoveOpen(false)}
        onConfirm={removeWithAnimation}
      />
    </article>
  );
}
