import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';

interface MenuSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearchBar({ value, onChange }: MenuSearchBarProps) {
  return (
    <label className="lcb-polished-search relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-central-orange" size={19} />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar hamburguesas, lomitos, pizzas..."
        className="lcb-polished-search-input h-11 rounded-[12px] border pl-11 text-[13px] font-medium outline-none transition-colors duration-200 sm:h-12 sm:pl-12 sm:text-[14px]"
      />
    </label>
  );
}
