'use client';

import { Tooltip } from 'recharts';
import { formatCurrency } from '@/shared/utils/format.utils';

type Metric = 'currency' | 'count' | 'percent';
const decimalFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const compactFormatter = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatChartCurrencyAxis(value: number | string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? '$' + compactFormatter.format(numeric) : '—';
}

function formatValue(value: unknown, metric: Metric) {
  const originalValue = Array.isArray(value) ? value[0] : value;
  const numeric = Number(originalValue);
  if (originalValue == null || !Number.isFinite(numeric)) return '—';
  if (metric === 'currency') return formatCurrency(numeric);
  if (metric === 'percent') return decimalFormatter.format(numeric) + ' %';
  return decimalFormatter.format(numeric);
}

/** Tooltip coherente y legible en español argentino para todas las gráficas. */
export function ChartValueTooltip({ metric, metricName }: { metric: Metric; metricName?: string }) {
  return (
    <Tooltip
      formatter={(value, name) => [formatValue(value, metric), metricName ?? String(name ?? '')]}
      contentStyle={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '9px 12px',
        boxShadow: '0 7px 22px rgba(20,20,20,.10)',
        fontSize: 12,
        color: '#24262b',
        maxWidth: 280,
      }}
      labelStyle={{ color: '#777b85', fontSize: 11, fontWeight: 500, marginBottom: 3 }}
      itemStyle={{ color: '#25272c', fontSize: 12, fontWeight: 600 }}
      wrapperStyle={{ outline: 'none', zIndex: 10, maxWidth: 'calc(100vw - 32px)' }}
    />
  );
}
