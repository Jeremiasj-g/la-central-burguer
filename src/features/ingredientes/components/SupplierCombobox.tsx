'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';

type Props = {
  id: string;
  value: string;
  suppliers: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
};

function normalize(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function SupplierCombobox({ id, value, suppliers, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const query = normalize(value);

  const matches = useMemo(() => suppliers
    .filter(supplier => normalize(supplier).includes(query))
    .slice(0, 8), [suppliers, query]);

  const exactMatch = suppliers.some(supplier => normalize(supplier) === query);
  const newOption = Boolean(value.trim() && !exactMatch);
  const optionCount = matches.length + (newOption ? 1 : 0);

  function selectSupplier(supplier: string) {
    onChange(supplier);
    setOpen(false);
    setHighlight(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight(index => Math.min(index + 1, Math.max(0, optionCount - 1)));
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault();
      setHighlight(index => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open && optionCount > 0) {
      event.preventDefault();
      if (highlight < matches.length) selectSupplier(matches[highlight]);
      else selectSupplier(value.trim());
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative flex w-full min-w-0 items-center">
          <Search size={16} className="pointer-events-none absolute left-3 text-neutral-400" />
          <input
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-label="Proveedor"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            value={value}
            placeholder={placeholder ?? 'Buscar proveedor...'}
            onFocus={() => { setOpen(true); setHighlight(0); }}
            onClick={() => setOpen(true)}
            onChange={event => { onChange(event.target.value); setHighlight(0); setOpen(true); }}
            onKeyDown={handleKeyDown}
            className="h-10 w-full min-w-0 rounded-[11px] border border-neutral-300 bg-white py-2 pl-10 pr-16 text-[13px] text-neutral-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-neutral-400 hover:border-neutral-400 focus:border-central-orange focus:ring-2 focus:ring-central-orange/10"
          />
          {value ? (
            <button type="button" aria-label="Borrar proveedor" title="Borrar proveedor"
              onClick={() => { onChange(''); setHighlight(0); setOpen(true); }}
              className="absolute right-9 grid h-7 w-7 place-items-center rounded-[8px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
              <X size={14}/>
            </button>
          ) : null}
          <button type="button" aria-label="Mostrar proveedores" aria-expanded={open}
            onClick={() => setOpen(prev => !prev)}
            className="absolute right-2 grid h-7 w-7 place-items-center rounded-[8px] text-neutral-500 hover:bg-neutral-100">
            <ChevronDown size={15}/>
          </button>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          collisionPadding={12}
          onOpenAutoFocus={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}
          className="z-[230] w-[var(--radix-popper-anchor-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[12px] border border-neutral-200 bg-white p-1.5 text-neutral-800 shadow-[0_15px_40px_rgba(15,23,42,.14)]"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[.09em] text-neutral-400">
            {query ? 'Coincidencias' : 'Proveedores registrados'}
          </div>
          <div id={listId} role="listbox" aria-label="Sugerencias de proveedor" className="custom-scrollbar max-h-[220px] overflow-y-auto">
            {matches.map((supplier, index) => (
              <button key={supplier} type="button" role="option"
                aria-selected={normalize(supplier) === query} onClick={() => selectSupplier(supplier)}
                onMouseEnter={() => setHighlight(index)}
                className={'flex min-h-9 w-full items-center justify-between gap-2 rounded-[9px] px-2.5 py-2 text-left text-[12px] transition-colors ' +
                  (index === highlight ? 'bg-[#fff4e7] text-[#955e19]' : 'text-neutral-700 hover:bg-neutral-50')}>
                <span className="min-w-0 truncate">{supplier}</span>
                {normalize(supplier) === query ? <Check size={15} className="shrink-0 text-[#bf7f26]"/> : null}
              </button>
            ))}
            {!matches.length && !newOption ? <p className="px-2.5 py-3 text-[11px] text-neutral-400">Todavía no hay proveedores registrados.</p> : null}
            {newOption ? (
              <button type="button" role="option" aria-selected={false}
                onMouseEnter={() => setHighlight(matches.length)}
                onClick={() => selectSupplier(value.trim())}
                className={'mt-1 flex min-h-10 w-full items-center gap-2 rounded-[9px] border-t border-neutral-100 px-2.5 py-2 text-left text-[12px] ' +
                  (highlight === matches.length ? 'bg-[#fff4e7] text-[#955e19]' : 'text-neutral-700 hover:bg-neutral-50')}>
                <Plus size={15} className="shrink-0 text-[#be852e]"/>
                <span className="min-w-0 truncate">Usar «{value.trim()}» como nuevo proveedor</span>
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
