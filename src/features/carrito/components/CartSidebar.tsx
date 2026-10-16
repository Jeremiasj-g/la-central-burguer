'use client';

import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types/carrito.types';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { CartItemRow } from './CartItemRow';
import { formatCurrency } from '@/shared/utils/format.utils';

interface CartSidebarProps {
  items: CartItem[];
  total: number;
  checkoutDisabled?: boolean;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}

export function CartSidebar({ items, total, checkoutDisabled = false, onUpdateQuantity, onUpdateNote, onRemove, onClear, onCheckout }: CartSidebarProps) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const clearTimerRef = useRef<number | null>(null);
  const disabled = items.length === 0 || checkoutDisabled || isClearing;
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => () => {
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
  }, []);

  function clearWithAnimation() {
    setConfirmClearOpen(false);
    setIsClearing(true);
    clearTimerRef.current = window.setTimeout(() => {
      onClear();
      setIsClearing(false);
    }, 200);
  }

  return (
    <>
      <aside className="sticky top-[92px] z-20 hidden h-[calc(100dvh-112px)] min-h-[470px] min-w-0 self-start flex-col overflow-hidden rounded-[20px] border border-white/[.085] bg-[#171717] text-[#f6f5f2] shadow-[0_16px_45px_rgba(0,0,0,.16)] lg:flex">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[.075] px-5 py-5">
          <div className="min-w-0">
            <h2 className="text-[23px] font-semibold leading-tight tracking-[-.035em]">Mi pedido</h2>
            <p className="mt-1 text-[11px] font-normal text-white/45">
              {quantity} {quantity === 1 ? 'producto' : 'productos'} en tu pedido
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/[.055] text-[#f1b34f]">
            <ShoppingBag size={19} strokeWidth={1.7} />
          </span>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[170px] flex-col items-center justify-center py-8 text-center">
              <ShoppingBag size={39} strokeWidth={1.4} className="text-white/30" />
              <p className="mt-4 text-[13px] font-semibold text-white/85">Tu carrito está vacío</p>
              <p className="mt-1.5 text-[11px] leading-5 text-white/45">Agregá productos desde el menú.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[.075]">
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onUpdateNote={onUpdateNote}
                  onRemove={onRemove}
                  forceRemoving={isClearing}
                />
              ))}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-white/[.075] px-5 pb-5 pt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-normal text-white/45">Total del carrito</p>
              <p className="mt-0.5 text-[24px] font-semibold tracking-[-.045em] tabular-nums">{formatCurrency(total)}</p>
            </div>
            {items.length > 0 ? (
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[11px] font-medium text-white/45 transition-colors duration-200 hover:bg-red-500/[.08] hover:text-red-300 disabled:opacity-40"
                onClick={() => setConfirmClearOpen(true)}
                disabled={isClearing}
              >
                <Trash2 size={14} strokeWidth={1.7} /> Vaciar
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-central-orange px-4 text-[13px] font-semibold text-[#191919] transition-[background-color,transform,opacity] duration-200 hover:bg-[#ffc04a] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
            title={checkoutDisabled ? 'Local cerrado, intentá más tarde' : 'Confirmar pedido'}
            disabled={disabled}
            onClick={onCheckout}
          >
            Confirmar pedido <ArrowRight size={17} strokeWidth={1.9} />
          </button>
        </footer>
      </aside>

      <ConfirmDialog
        open={confirmClearOpen && items.length > 0}
        title="Vaciar carrito"
        description="¿Seguro que querés eliminar todos los productos del pedido?"
        confirmLabel="Vaciar carrito"
        tone="danger"
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={clearWithAnimation}
      />
    </>
  );
}
