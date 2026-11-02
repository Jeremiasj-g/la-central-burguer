'use client';

import { Search, X } from 'lucide-react';

interface MenuSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearchBar({ value, onChange }: MenuSearchBarProps) {
  return (
    <label className="relative block w-full">
      <span className="sr-only">Buscar en el menú</span>
      <Search size={19} strokeWidth={1.7} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
      <input type="search" value={value} onChange={event => onChange(event.target.value)}
        placeholder="¿Qué se te antoja hoy?"
        className="chet-menu-search h-12 w-full rounded-[15px] border border-white/10 bg-[#222124] pl-12 pr-12 text-sm font-normal text-white outline-none placeholder:text-white/40 focus:border-[#ff933d]/65 focus:ring-1 focus:ring-[#ff933d]/30 sm:h-14" />
      {value ? (
        <button type="button" aria-label="Limpiar búsqueda" title="Limpiar búsqueda" onClick={() => onChange('')}
          className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white/55 transition-transform duration-200 hover:scale-110 hover:text-white motion-reduce:transition-none">
          <X size={17} strokeWidth={1.7}/>
        </button>
      ) : null}
    </label>
  );
}
