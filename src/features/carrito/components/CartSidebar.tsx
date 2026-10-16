'use client';

import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types/carrito.types';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { CartItemRow } from './CartItemRow';
import { formatCurrency } from '@/shared/utils/format.utils';
import { usePublicTheme } from '@/shared/components/layout/PublicThemeProvider';

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
  const theme = usePublicTheme();
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
      <aside className="lcb-cart-sidebar sticky top-[102px] hidden min-w-0 self-start lg:flex lg:flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--lcb-border)] pb-4">
          <div>
            <p className="lcb-section-eyebrow">Tu selección</p>
            <h3 className="mt-1.5 text-[23px] font-semibold leading-tight tracking-[-.045em]">Mi pedido</h3>
          </div>
          <span className="lcb-cart-icon grid h-10 w-10 place-items-center rounded-[12px]"><ShoppingBag size={18} strokeWidth={1.8}/></span>
        </div>

        <div className="custom-scrollbar min-h-[155px] max-h-[min(44dvh,390px)] flex-1 overflow-y-auto py-2 pr-1">
          {!items.length ? (
            <div className="flex min-h-[175px] flex-col items-center justify-center text-center">
              <span className="lcb-empty-cart-icon grid h-14 w-14 place-items-center rounded-[17px]"><ShoppingBag size={25} strokeWidth={1.4}/></span>
              <p className="mt-4 text-[13px] font-semibold">Tu carrito está vacío</p>
              <p className="mt-1.5 max-w-[220px] text-[11px] leading-5 text-[var(--lcb-muted)]">Elegí algo rico del menú y lo vas a encontrar acá.</p>
            </div>
          ) : items.map(item => (
            <CartItemRow key={item.id} item={item} onUpdateQuantity={onUpdateQuantity}
              onUpdateNote={onUpdateNote} onRemove={onRemove} forceRemoving={isClearing}/>
          ))}
        </div>

        <div className="border-t border-[var(--lcb-border)] pt-4">
          {items.length ? (
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--lcb-muted)]">{quantity} {quantity===1?'producto':'productos'} en tu pedido</p>
              <button type="button" className="lcb-cart-clear inline-flex items-center gap-1.5 text-[11px]" onClick={()=>setConfirmClearOpen(true)} disabled={isClearing}>
                <Trash2 size={13}/> Vaciar
              </button>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 pb-4">
            <span className="text-[13px] font-medium text-[var(--lcb-muted)]">Total estimado</span>
            <span className="text-[22px] font-semibold tracking-[-.035em] tabular-nums">{formatCurrency(total)}</span>
          </div>
          <Button type="button" className="lcb-cart-checkout flex h-12 w-full items-center justify-center gap-2 rounded-[13px] text-[13px] font-semibold"
            title={checkoutDisabled ? 'El local no está recibiendo pedidos' : 'Continuar con el pedido'} disabled={disabled} onClick={onCheckout}>
            Continuar pedido <ArrowRight size={16}/>
          </Button>
          <p className="mt-3 text-center text-[10px] leading-4 text-[var(--lcb-muted)]">
            Confirmás los datos de entrega antes de enviar.
          </p>
        </div>
      </aside>
      <ConfirmDialog open={confirmClearOpen && items.length > 0} title="Vaciar carrito"
        description="¿Seguro que querés eliminar todos los productos del pedido?"
        confirmLabel="Vaciar carrito" tone="danger" theme={theme}
        onCancel={() => setConfirmClearOpen(false)} onConfirm={clearWithAnimation}/>
    </>
  );
}
