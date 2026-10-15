import { TrendingUp } from 'lucide-react';
import { AnimatedValue } from '@/shared/components/ui/AnimatedValue';
import { formatCurrency } from '@/shared/utils/format.utils';
import type { MetricSummary } from '../types/dashboard.types';

const formatNumber = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(value));

export function DashboardMetricCard({ metric }: { metric: MetricSummary }) {
  const formatter = metric.valueKind === 'currency' ? formatCurrency : formatNumber;

  return (
    <article className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[12px] font-medium text-neutral-500">{metric.label}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-central-orange/10 px-2.5 py-1 text-[11px] font-medium text-central-orange"><TrendingUp size={13} /> {metric.trend}</span>
      </div>
      <p className="mt-3 break-words text-[28px] font-semibold leading-tight tracking-[-.045em] tabular-nums text-central-carbon sm:text-[30px]">
        <AnimatedValue value={metric.numericValue} formatter={formatter} />
      </p>
      <p className="mt-2 text-[12px] leading-5 text-neutral-500">{metric.hint}</p>
    </article>
  );
}
