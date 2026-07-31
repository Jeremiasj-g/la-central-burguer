import { ShoppingBag } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export function EmptyState({ title, description, className }: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn('grid place-items-center rounded-sm border border-dashed border-neutral-300 bg-white/70 p-10 text-center', className)}>
      <div className="grid h-16 w-16 place-items-center rounded-sm bg-central-orange/10 text-central-orange">
        <ShoppingBag size={28} />
      </div>
      <h3 className="mt-4 text-lg font-black text-central-carbon">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-neutral-500">{description}</p> : null}
    </div>
  );
}
