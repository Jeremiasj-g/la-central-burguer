import { ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/format.utils';

interface CartFloatingButtonProps {
  count: number;
  total: number;
  onClick: () => void;
}

export function CartFloatingButton({ count, total, onClick }: CartFloatingButtonProps) {
  return (
    <button onClick={onClick} className="lcb-polished-floating-cart fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2.5 rounded-[17px] border px-3.5 py-3 transition-transform duration-200 hover:-translate-y-0.5 lg:hidden">
      <span className="relative grid h-10 w-10 place-items-center rounded-[12px] bg-central-orange text-black">
        <ShoppingBag />
        {count > 0 ? <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-central-cream text-[10px] font-black text-black">{count}</span> : null}
      </span>
      <span className="text-left text-xs font-black leading-tight">Mi pedido<br /><span className="text-central-orange">{formatCurrency(total)}</span></span>
    </button>
  );
}
