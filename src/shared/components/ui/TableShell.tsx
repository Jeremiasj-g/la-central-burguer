import { cn } from '@/shared/utils/cn';

export function TableShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft', className)}>{children}</div>;
}
