import { Search, X } from 'lucide-react';

interface MenuSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearchBar({ value, onChange }: MenuSearchBarProps) {
  return (
    <label className="lcb-menu-search relative flex min-w-0 items-center">
      <Search size={18} strokeWidth={1.8} className="ml-4 shrink-0 text-[var(--lcb-muted)]" />
      <input type="search" inputMode="search" enterKeyHint="search" value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="¿Qué se te antoja hoy?"
        aria-label="Buscar en el menú"
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[13px] outline-none placeholder:text-[var(--lcb-muted)] sm:py-4 sm:text-[14px]"/>
      {value ? <button type="button" onClick={() => onChange('')} title="Limpiar búsqueda"
        aria-label="Limpiar búsqueda" className="mr-3 grid h-8 w-8 place-items-center rounded-full text-[var(--lcb-muted)] hover:bg-[var(--lcb-hover)]"><X size={15}/></button> : null}
    </label>
  );
}
