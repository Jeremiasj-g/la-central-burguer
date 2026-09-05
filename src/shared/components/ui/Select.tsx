'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { SelectOption } from '@/shared/types/common.types';
import { cn } from '@/shared/utils/cn';

type SelectVariant = 'dark' | 'light';

interface SelectProps {
  value?: string;
  defaultValue?: string;
  options: readonly SelectOption[];
  onValueChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  contentClassName?: string;
  variant?: SelectVariant;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const triggerVariants: Record<SelectVariant, string> = {
  light: 'border-neutral-200 bg-white text-central-carbon shadow-[0_1px_2px_rgba(17,16,15,.04)] hover:border-central-orange/55 hover:bg-[#fffdf8] data-[state=open]:border-central-orange data-[state=open]:ring-2 data-[state=open]:ring-central-orange/15 disabled:bg-neutral-100 disabled:text-neutral-400',
  dark: 'border-white/12 bg-[#1b1b1b] text-white shadow-[0_1px_2px_rgba(0,0,0,.18)] hover:border-central-orange/60 hover:bg-[#211f1c] data-[state=open]:border-central-orange data-[state=open]:ring-2 data-[state=open]:ring-central-orange/25 disabled:text-white/35',
};

const iconVariants: Record<SelectVariant, string> = {
  light: 'bg-central-orange/9 text-central-orange group-hover:bg-central-orange/14',
  dark: 'bg-white/[.07] text-central-orange group-hover:bg-central-orange/12',
};

const contentVariants: Record<SelectVariant, string> = {
  light: 'border-neutral-200 bg-white text-central-carbon shadow-[0_18px_45px_rgba(17,16,15,.16)]',
  dark: 'border-white/12 bg-[#191715] text-central-cream shadow-dark',
};

const itemVariants: Record<SelectVariant, string> = {
  light: 'text-neutral-700 data-[highlighted]:bg-central-orange/10 data-[highlighted]:text-central-ember data-[state=checked]:bg-central-orange/8 data-[state=checked]:font-extrabold data-[state=checked]:text-central-ember',
  dark: 'text-white/78 data-[highlighted]:bg-central-orange/12 data-[highlighted]:text-white data-[state=checked]:bg-central-orange/10 data-[state=checked]:font-extrabold data-[state=checked]:text-central-cream',
};

export function Select({
  value,
  defaultValue,
  options,
  onValueChange,
  placeholder = 'Seleccionar una opción',
  name,
  disabled,
  required,
  className,
  contentClassName,
  variant = 'dark',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        type="button"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'group flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-sm border px-3 text-left text-base outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:border-central-orange focus-visible:ring-2 focus-visible:ring-central-orange/25 disabled:cursor-not-allowed sm:text-sm',
          triggerVariants[variant],
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-sm transition-colors', iconVariants[variant])}>
            <ChevronDown size={15} strokeWidth={2.4} className="transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'lcb-dropdown-content z-[220] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-sm border p-1',
            contentVariants[variant],
            contentClassName,
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center text-central-orange">
            <ChevronUp size={16} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="custom-scrollbar max-h-[18rem] overflow-y-auto">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex min-h-9 cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-9 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                  itemVariants[variant],
                )}
              >
                <span className="min-w-0 truncate">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </span>
                <SelectPrimitive.ItemIndicator className="absolute right-3 grid place-items-center text-central-orange">
                  <Check size={15} strokeWidth={2.7} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center text-central-orange">
            <ChevronDown size={16} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
