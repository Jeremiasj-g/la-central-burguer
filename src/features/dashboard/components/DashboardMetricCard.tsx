import { TrendingUp } from 'lucide-react';
import type { MetricSummary } from '../types/dashboard.types';

export function DashboardMetricCard({ metric }: { metric: MetricSummary }) {
  return (
    <article className="rounded-sm border border-neutral-200 bg-white p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-bold text-neutral-500">{metric.label}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-central-orange/10 px-2.5 py-1 text-xs font-black text-central-orange"><TrendingUp size={13} /> {metric.trend}</span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-central-carbon">{metric.value}</p>
      <p className="mt-2 text-sm text-neutral-500">{metric.hint}</p>
    </article>
  );
}
