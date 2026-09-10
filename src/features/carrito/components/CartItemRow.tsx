'use client';

import { Check, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types/carrito.types';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { formatCurrency } from '@/shared/utils/format.utils';
import { ProductImageMedia } from '@/features/productos/components/ProductImageMedia';
import { cn } from '@/shared/utils/cn';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  forceRemoving?: boolean;
}

export function CartItemRow({ item, onUpdateQuantity, onUpdateNote, onRemove, forceRemoving = false }: CartItemRowProps) {
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(item.note ?? '');
  const [isRemoving, setIsRemoving] = useState(false);
  const removeTimerRef = useRef<number | null>(null);
  const removing = isRemoving || forceRemoving;

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
    <div
      className={cn(
        'grid grid-cols-[48px_1fr_auto] gap-3 py-3 transition-[opacity,transform] duration-200 ease-in-out motion-reduce:transition-none sm:grid-cols-[58px_1fr_auto] sm:gap-4 sm:py-4',
        removing ? 'pointer-events-none -translate-x-4 opacity-0' : 'translate-x-0 opacity-100',
      )}
    >
      <ProductImageMedia
        imageUrl={item.imageUrl}
        productName={item.productName}
        categoryName={item.categoryName}
        className="h-12 w-12 rounded-sm border border-central-orange/20 bg-black sm:h-14 sm:w-14"
        compact
      />
      <div className="min-w-0">
        <h4 className="text-sm font-black leading-tight text-central-cream sm:text-base">{item.productName}</h4>
        <p className="mt-0.5 text-xs font-black text-central-cream/52 sm:mt-1 sm:text-sm">{formatCurrency(item.unitPrice)}</p>

        {editingNote ? (
          <div className="mt-2 rounded-sm border border-central-orange/25 bg-black/35 p-2 transition duration-200">
            <textarea
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
              className="custom-scrollbar min-h-14 w-full resize-none bg-transparent text-sm leading-5 text-central-cream outline-none placeholder:text-central-cream/35"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-sm border border-white/10 text-white/60 transition duration-200 hover:bg-white/10 hover:text-white"
                title="Cancelar edición"
                aria-label="Cancelar edición de aclaración"
                onClick={cancelNoteEdit}
              >
                <X size={14} />
              </button>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-sm border border-central-orange/35 bg-central-orange text-black transition duration-200 hover:bg-central-cream"
                title="Guardar aclaración"
                aria-label="Guardar aclaración"
                onClick={saveNote}
              >
                <Check size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex min-w-0 items-start gap-2">
            {item.note ? (
              <p className="min-w-0 flex-1 break-words rounded-sm border border-central-orange/20 bg-black/35 px-2.5 py-1.5 text-xs leading-5 text-central-cream/70">
                {item.note}
              </p>
            ) : (
              <span className="min-w-0 flex-1 text-xs text-central-cream/35">Sin aclaración</span>
            )}
            <button
              type="button"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-central-orange/20 text-central-cream/60 transition duration-200 hover:bg-central-orange hover:text-black"
              title={item.note ? 'Editar aclaración' : 'Agregar aclaración'}
              aria-label={item.note ? 'Editar aclaración' : 'Agregar aclaración'}
              onClick={() => setEditingNote(true)}
            >
              <Pencil size={13} />
            </button>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:gap-3">
          <button className="grid h-7 w-7 place-items-center rounded-sm border border-central-orange/20 text-central-cream/70 transition duration-200 hover:bg-central-orange hover:text-black sm:h-8 sm:w-8" title="Disminuir cantidad" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}><Minus size={14} /></button>
          <span className="w-5 text-center font-black">{item.quantity}</span>
          <button className="grid h-7 w-7 place-items-center rounded-sm border border-central-orange/20 text-central-cream/70 transition duration-200 hover:bg-central-orange hover:text-black sm:h-8 sm:w-8" title="Aumentar cantidad" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-central-cream sm:text-base">{formatCurrency(item.unitPrice * item.quantity)}</p>
        <button
          className="mt-3 rounded-sm p-1.5 text-red-400 transition duration-200 hover:bg-red-500/10 disabled:cursor-default disabled:opacity-40 sm:mt-4 sm:p-2"
          title="Eliminar producto del pedido"
          onClick={() => setConfirmRemoveOpen(true)}
          aria-label="Eliminar item"
          disabled={removing}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Eliminar del pedido"
        description={`¿Seguro que querés quitar ${item.productName} del pedido?`}
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setConfirmRemoveOpen(false)}
        onConfirm={removeWithAnimation}
      />
    </div>
  );
}
