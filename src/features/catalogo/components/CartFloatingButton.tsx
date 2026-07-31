import { ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/format.utils';

interface CartFloatingButtonProps {
  count: number;
  total: number;
  onClick: () => void;
}

export function CartFloatingButton({ count, total, onClick }: CartFloatingButtonProps) {
  return (
    <button onClick={onClick} className="fixed bottom-4 right-4 z-30 flex items-center gap-2.5 rounded-sm border border-central-orange/40 bg-[#11100f] px-3.5 py-3 text-central-cream shadow-dark transition hover:-translate-y-1 hover:border-central-orange lg:hidden">
      <span className="relative grid h-10 w-10 place-items-center rounded-sm bg-central-orange text-black">
        <ShoppingBag />
        {count > 0 ? <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-central-cream text-[10px] font-black text-black">{count}</span> : null}
      </span>
      <span className="text-left text-xs font-black leading-tight">Mi pedido<br /><span className="text-central-orange">{formatCurrency(total)}</span></span>
    </button>
  );
}
