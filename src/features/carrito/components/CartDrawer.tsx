'use client';

import { ShoppingBag } from 'lucide-react';
import type { CartItem } from '../types/carrito.types';
import { CartItemRow } from './CartItemRow';
import { Button } from '@/shared/components/ui/Button';
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
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, items, total, checkoutDisabled = false, onUpdateQuantity, onUpdateNote, onRemove, onCheckout }: CartDrawerProps) {
  const disabled = items.length === 0 || checkoutDisabled;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Mi pedido"
      footer={
        <div>
          <div className="mb-3 flex items-center justify-between text-lg sm:mb-5 sm:text-xl font-black">
            <span>Total</span>
            <span className="text-central-orange">{formatCurrency(total)}</span>
          </div>
          <Button size="sm" className="w-full rounded-sm sm:h-11" title={checkoutDisabled ? 'Local cerrado, intente más tarde' : 'Confirmar pedido'} disabled={disabled} onClick={onCheckout}>Confirmar pedido</Button>
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
          {items.map((item) => <CartItemRow key={item.id} item={item} onUpdateQuantity={onUpdateQuantity} onUpdateNote={onUpdateNote} onRemove={onRemove} />)}
        </div>
      )}
    </Drawer>
  );
}
