'use client';

import { ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types/carrito.types';
import { CartItemRow } from './CartItemRow';
import { Button } from '@/shared/components/ui/Button';
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
        footer={
          <div>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-sm border border-red-500/25 px-3 py-2 text-xs font-bold text-red-300 transition duration-200 hover:border-red-400/45 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none"
                onClick={() => setConfirmClearOpen(true)}
                disabled={items.length === 0 || isClearing}
              >
                <Trash2 size={14} />
                Vaciar carrito
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between text-lg font-black sm:mb-5 sm:text-xl">
              <span>Total</span>
              <span className="text-central-orange">{formatCurrency(total)}</span>
            </div>
            <Button size="sm" className="w-full rounded-sm transition duration-200 sm:h-11" title={checkoutDisabled ? 'Local cerrado, intente más tarde' : 'Confirmar pedido'} disabled={disabled} onClick={onCheckout}>Confirmar pedido</Button>
          </div>
        }
      >
        {items.length === 0 ? (
          <div className="grid min-h-[48dvh] place-items-center">
            <div className="text-center text-white/45">
              <ShoppingBag className="mx-auto mb-4" size={68} strokeWidth={1} />
              <p>Pedido vacío</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
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
