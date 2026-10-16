import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';

interface MenuSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearchBar({ value, onChange }: MenuSearchBarProps) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-central-orange" size={19} />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar hamburguesas, lomitos, pizzas..."
        className="lcb-menu-search-input h-11 rounded-[12px] border border-white/[.085] bg-[#222222] pl-11 text-base sm:h-16 sm:pl-14 font-normal text-central-cream shadow-none outline-none placeholder:text-central-cream/38 focus:border-central-orange focus:ring-central-orange/40"
      />
    </label>
  );
}
