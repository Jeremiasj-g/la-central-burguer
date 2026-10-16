'use client';

import { ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types/carrito.types';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { CartItemRow } from './CartItemRow';
import { formatCurrency } from '@/shared/utils/format.utils';
import { useCustomerTheme } from '@/shared/components/layout/CustomerThemeProvider';

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
  const theme = useCustomerTheme();

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
      <aside className="lcb-polished-cart sticky top-[98px] z-20 hidden h-[min(720px,calc(100dvh-116px))] min-h-[490px] self-start rounded-[20px] border p-5 lg:flex lg:flex-col xl:p-6">
        <div className="flex shrink-0 items-center justify-between gap-3 lcb-polished-cart-divider border-b pb-4">
          <div>
            <p className="lcb-polished-eyebrow text-[10px] font-semibold uppercase tracking-[.14em]">Resumen</p>
            <h2 className="lcb-polished-cart-title mt-1.5 text-[24px] font-semibold leading-tight tracking-[-.035em]">Mi pedido</h2>
          </div>
          <div className="lcb-polished-cart-icon grid h-11 w-11 place-items-center rounded-[13px]">
            <ShoppingBag />
          </div>
        </div>
        <div className="custom-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-3">
          {items.length === 0 ? (
            <div className="lcb-polished-cart-empty grid h-full place-items-center text-center">
              <div>
                <ShoppingBag className="mx-auto mb-4" size={52} strokeWidth={1.3} />
                <p className="font-bold">Pedido vacío</p>
                <p className="mt-2 text-sm">Agregá productos desde el menú.</p>
              </div>
            </div>
          ) : (
            <div className="lcb-polished-cart-items divide-y">
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
        <div className="shrink-0 lcb-polished-cart-divider border-t pt-5">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              className="lcb-polished-cart-clear inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[11px] font-medium transition-colors duration-200 disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none"
              onClick={() => setConfirmClearOpen(true)}
              disabled={items.length === 0 || isClearing}
            >
              <Trash2 size={14} />
              Vaciar carrito
            </button>
          </div>
          <div className="lcb-polished-cart-total mb-5 flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium">Total</span>
            <span className="lcb-polished-product-price text-[23px] font-semibold tracking-[-.04em]">{formatCurrency(total)}</span>
          </div>
          <Button className="lcb-polished-checkout-button h-12 w-full rounded-[12px] text-[13px] font-semibold transition duration-200" title={checkoutDisabled ? 'Local cerrado, intente más tarde' : 'Confirmar pedido'} disabled={disabled} onClick={onCheckout}>Confirmar pedido</Button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmClearOpen && items.length > 0}
        title="Vaciar carrito"
        description="¿Seguro que querés eliminar todos los productos del pedido?"
        confirmLabel="Vaciar carrito"
        tone="danger"
        theme={theme}
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={clearWithAnimation}
      />
    </>
  );
}
