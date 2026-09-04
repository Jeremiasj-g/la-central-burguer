import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  href?: string;
  children: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-central-orange text-white shadow-orange hover:bg-central-ember',
  secondary: 'bg-white text-central-carbon border border-neutral-200 hover:border-central-orange/50 hover:text-central-orange',
  dark: 'bg-central-carbon text-white hover:bg-neutral-800 shadow-soft',
  ghost: 'bg-transparent text-current hover:bg-black/5',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
};

export function Button({ className, variant = 'primary', size = 'md', asChild, href, children, ...props }: ButtonProps) {
  const classes = cn(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-central-orange focus:ring-offset-2',
    variants[variant],
    sizes[size],
    className,
  );

  if (asChild && href) {
    return <Link className={classes} href={href}>{children}</Link>;
  }

  return <button className={classes} {...props}>{children}</button>;
}
