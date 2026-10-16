import { ArrowRight, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/format.utils';

interface CartFloatingButtonProps {
  count: number;
  total: number;
  onClick: () => void;
}

export function CartFloatingButton({ count, total, onClick }: CartFloatingButtonProps) {
  return (
    <button type="button" onClick={onClick} className="lcb-floating-cart fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[35] flex items-center justify-between gap-4 px-4 py-3 lg:hidden" aria-label={`Ver mi pedido de ${count} productos, total ${formatCurrency(total)}`}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-white/15"><ShoppingBag size={19}/></span>
        <span className="min-w-0 text-left"><span className="block text-[11px] text-white/65">{count} {count===1?'producto':'productos'}</span><span className="block text-[15px] font-semibold">{formatCurrency(total)}</span></span>
      </span>
      <span className="flex items-center gap-2 text-[12px] font-semibold">Ver pedido <ArrowRight size={16}/></span>
    </button>
  );
}
