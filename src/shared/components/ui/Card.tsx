import { cn } from '@/shared/utils/cn';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div data-ui="card" className={cn('rounded-sm border border-neutral-200 bg-white shadow-soft', className)}>{children}</div>;
}
