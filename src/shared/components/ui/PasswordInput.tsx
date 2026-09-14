'use client';

import { useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type PasswordInputVariant = 'dark' | 'light';

interface PasswordInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  variant?: PasswordInputVariant;
  wrapperClassName?: string;
}

const inputVariants: Record<PasswordInputVariant, string> = {
  dark: 'border-white/12 bg-[#1b1b1b] text-white placeholder:text-white/38 focus:border-central-orange focus:ring-central-orange/25',
  light: 'border-neutral-200 bg-white text-central-carbon placeholder:text-neutral-400 focus:border-central-orange focus:ring-central-orange/15',
};

const buttonVariants: Record<PasswordInputVariant, string> = {
  dark: 'text-white/45 hover:bg-white/8 hover:text-white focus-visible:ring-white/25',
  light: 'text-neutral-400 hover:bg-neutral-100 hover:text-central-carbon focus-visible:ring-central-orange/25',
};

export function PasswordInput({
  className,
  wrapperClassName,
  variant = 'dark',
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <input
        {...props}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={cn(
          'h-10 w-full rounded-sm border px-3 pr-11 text-base outline-none transition sm:text-sm focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
          inputVariants[variant],
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className={cn(
          'absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-sm outline-none transition focus-visible:ring-2 disabled:cursor-not-allowed',
          buttonVariants[variant],
        )}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  );
}
