'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChartValueTooltip } from './ChartValueTooltip';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';

const colors = ['#D88918', '#11100F'];

function formatOrderCount(count: number) {
  return `${count} ${count === 1 ? 'pedido' : 'pedidos'}`;
}

export function DeliveryMethodChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
      <h3 className="text-[15px] font-semibold tracking-[-.025em] text-central-carbon sm:text-[16px]">Delivery vs retiro local</h3>
      <div className="mt-4 h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={4}>
              {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
            </Pie>
            <ChartValueTooltip metric="percent" />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-medium text-neutral-600">
        {data.map((item, index) => (
          <span key={item.name} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} />
            {item.name}: {item.value}%{typeof item.orders === 'number' ? ` · ${formatOrderCount(item.orders)}` : ''}
          </span>
        ))}
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
