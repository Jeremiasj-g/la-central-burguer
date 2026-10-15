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
    <article className="group min-w-0 rounded-[20px] border border-black/[.055] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,.025),0_10px_28px_rgba(0,0,0,.025)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[.09em] text-[#86868b]">{label}</p>
          <p className="mt-2 break-words text-[32px] font-semibold leading-none tracking-[-.05em] text-[#1d1d1f] sm:text-[36px]">
            <AnimatedFormattedValue value={value} />
          </p>
          <p className="mt-2 text-[12px] leading-5 text-[#6e6e73]">{detail}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#eaf3ff] text-[#0071e3] transition-transform duration-200 group-hover:scale-[1.04]">
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
    </article>
  );
}
