import type { LucideIcon } from 'lucide-react';

interface DeliveryMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

export function DeliveryMetricCard({ icon: Icon, label, value, detail }: DeliveryMetricCardProps) {
  return (
    <article className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-black tracking-tight text-central-carbon">{value}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{detail}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange">
          <Icon size={18} />
        </span>
      </div>
    </article>
  );
}
