import { ShoppingBag } from 'lucide-react';
import type { CartItem } from '../types/carrito.types';
import { Button } from '@/shared/components/ui/Button';
import { CartItemRow } from './CartItemRow';
import { formatCurrency } from '@/shared/utils/format.utils';

interface CartSidebarProps {
  items: CartItem[];
  total: number;
  checkoutDisabled?: boolean;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export function CartSidebar({ items, total, checkoutDisabled = false, onUpdateQuantity, onUpdateNote, onRemove, onCheckout }: CartSidebarProps) {
  const disabled = items.length === 0 || checkoutDisabled;
  return (
    <aside className="sticky top-[84px] z-20 hidden h-[calc(100dvh-100px)] min-h-[520px] self-start rounded-sm border border-central-orange/25 bg-[#151311] p-6 text-central-cream shadow-dark lg:flex lg:flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-dashed border-central-orange/45 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.28em] text-central-orange">Resumen</p>
          <h2 className="mt-1 font-display text-4xl uppercase tracking-wide">Mi pedido</h2>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-sm border border-central-orange/35 bg-black/35 text-central-orange">
          <ShoppingBag />
        </div>
      </div>
      <div className="custom-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-3">
        {items.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-central-cream/45">
            <div>
              <ShoppingBag className="mx-auto mb-4" size={84} strokeWidth={1} />
              <p className="font-bold">Pedido vacío</p>
              <p className="mt-2 text-sm">Agregá productos desde el menú.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-central-orange/20">
            {items.map((item) => <CartItemRow key={item.id} item={item} onUpdateQuantity={onUpdateQuantity} onUpdateNote={onUpdateNote} onRemove={onRemove} />)}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-dashed border-central-orange/45 pt-5">
        <div className="mb-5 flex items-center justify-between text-xl font-black">
          <span className="font-display text-3xl uppercase tracking-wide">Total</span>
          <span className="font-display text-3xl text-central-orange">{formatCurrency(total)}</span>
        </div>
        <Button className="h-13 w-full rounded-sm bg-central-orange font-black uppercase tracking-wide text-black hover:bg-central-cream" title={checkoutDisabled ? 'Local cerrado, intente más tarde' : 'Confirmar pedido'} disabled={disabled} onClick={onCheckout}>Confirmar pedido</Button>
      </div>
    </aside>
  );
}
