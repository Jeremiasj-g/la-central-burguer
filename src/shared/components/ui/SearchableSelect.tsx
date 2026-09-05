'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Command } from 'cmdk';
import { useId, useState } from 'react';
import type { SelectOption } from '@/shared/types/common.types';
import { cn } from '@/shared/utils/cn';

interface SearchableSelectProps {
  value?: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  'aria-label'?: string;
}

export function SearchableSelect({
  value,
  options,
  onValueChange,
  placeholder = 'Seleccionar una opción',
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'No se encontraron resultados.',
  className,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value);

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={cn(
            'group flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-sm border border-neutral-200 bg-white px-3 text-left text-sm text-central-carbon shadow-[0_1px_2px_rgba(17,16,15,.04)] outline-none transition-[border-color,background-color,box-shadow] duration-150 hover:border-central-orange/55 hover:bg-[#fffdf8] focus-visible:border-central-orange focus-visible:ring-2 focus-visible:ring-central-orange/25 data-[state=open]:border-central-orange data-[state=open]:ring-2 data-[state=open]:ring-central-orange/15',
            className,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selectedOption && 'text-neutral-400')}>
            {selectedOption?.label ?? placeholder}
          </span>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-sm bg-central-orange/9 text-central-orange transition-colors group-hover:bg-central-orange/14">
            <ChevronsUpDown size={15} strokeWidth={2.3} />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="lcb-dropdown-content z-[220] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-sm border border-neutral-200 bg-white p-1 text-central-carbon shadow-[0_18px_45px_rgba(17,16,15,.16)]"
        >
          <Command loop>
            <div className="flex items-center gap-2 border-b border-neutral-100 px-2.5">
              <Search size={16} className="shrink-0 text-neutral-400" />
              <Command.Input
                autoFocus
                placeholder={searchPlaceholder}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-central-carbon outline-none placeholder:text-neutral-400"
              />
            </div>
            <Command.List id={listboxId} className="custom-scrollbar max-h-64 overflow-y-auto py-1">
              <Command.Empty className="px-3 py-5 text-center text-sm text-neutral-500">
                {emptyMessage}
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.label}
                  keywords={[option.value]}
                  disabled={option.disabled}
                  onSelect={() => handleSelect(option.value)}
                  className="relative flex min-h-9 cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-9 text-sm text-neutral-700 outline-none transition-colors data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40 data-[selected=true]:bg-central-orange/10 data-[selected=true]:text-central-ember"
                >
                  <span className={cn('truncate', option.value === value && 'font-extrabold text-central-ember')}>
                    {option.label}
                  </span>
                  {option.value === value ? (
                    <Check size={15} strokeWidth={2.7} className="absolute right-3 text-central-orange" />
                  ) : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
