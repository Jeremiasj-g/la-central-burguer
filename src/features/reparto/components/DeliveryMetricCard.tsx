import type { LucideIcon } from 'lucide-react';
import { AnimatedFormattedValue } from '@/shared/components/ui/AnimatedValue';

interface DeliveryMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

export function DeliveryMetricCard({ icon: Icon, label, value, detail }: DeliveryMetricCardProps) {
  return (
    <article className="min-w-0 border-b border-neutral-100 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[#f6f6f7] text-neutral-500">
          <Icon size={14} strokeWidth={1.8} />
        </span>
        <p className="min-w-0 text-[11px] font-medium text-neutral-500">{label}</p>
      </div>
      <p className="mt-3 break-words text-[clamp(1.4rem,2.1vw,2rem)] font-semibold leading-none tracking-[-.045em] text-neutral-900 [font-variant-numeric:tabular-nums]">
        <AnimatedFormattedValue value={value} />
      </p>
      <p className="mt-2 text-[11px] leading-4 text-neutral-400">{detail}</p>
    </article>
  );
}
