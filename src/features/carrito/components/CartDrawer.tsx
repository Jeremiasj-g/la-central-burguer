'use client';
// Verificación temporal del rediseño del carrito.

import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types/carrito.types';
import { CartItemRow } from './CartItemRow';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Drawer } from '@/shared/components/ui/Drawer';
import { formatCurrency } from '@/shared/utils/format.utils';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  checkoutDisabled?: boolean;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, items, total, checkoutDisabled = false, onUpdateQuantity, onUpdateNote, onRemove, onClear, onCheckout }: CartDrawerProps) {
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
      <Drawer
        open={open}
        onClose={onClose}
        title="Mi pedido"
        className="lcb-cart-drawer"
        footer={
          <div className="space-y-4">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-normal text-white/45">Total del carrito</p>
                <p className="mt-0.5 text-[26px] font-semibold leading-tight tracking-[-.045em] tabular-nums text-[#f6f5f3]" aria-live="polite">
                  {formatCurrency(total)}
                </p>
              </div>
              {items.length > 0 ? (
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[11px] font-medium text-white/45 transition-colors duration-200 hover:bg-red-500/[.08] hover:text-red-300 disabled:cursor-default disabled:opacity-40"
                  onClick={() => setConfirmClearOpen(true)}
                  disabled={isClearing}
                >
                  <Trash2 size={14} strokeWidth={1.7} />
                  Vaciar
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
          </div>
        }
      >
        {items.length === 0 ? (
          <div className="flex min-h-[210px] flex-col items-center justify-center px-3 py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-[17px] bg-white/[.055] text-[#f4af3e]">
              <ShoppingBag size={25} strokeWidth={1.55} />
            </span>
            <p className="mt-4 text-[14px] font-semibold text-white/90">Tu carrito está vacío</p>
            <p className="mt-1.5 max-w-[230px] text-[12px] leading-5 text-white/45">
              Explorá el menú y agregá algo rico a tu pedido.
            </p>
          </div>
        ) : (
          <div>
            <p className="border-b border-white/[.075] pb-2 text-[11px] font-medium text-white/45">
              {quantity} {quantity === 1 ? 'producto' : 'productos'} en tu pedido
            </p>
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
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={open && confirmClearOpen && items.length > 0}
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
