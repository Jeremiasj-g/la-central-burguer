import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/shared/utils/cn';

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full resize-y rounded-sm border border-white/12 bg-[#1b1b1b] px-3 py-3 text-base text-white sm:text-sm outline-none transition placeholder:text-white/38 focus:border-central-orange focus:ring-2 focus:ring-central-orange/25',
        className,
      )}
      {...props}
    />
  );
}
