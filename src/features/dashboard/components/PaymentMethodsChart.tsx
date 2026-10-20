'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChartValueTooltip } from './ChartValueTooltip';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';
const colors = ['#E45712', '#151515', '#C7440B'];

export function PaymentMethodsChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
      <h3 className="text-[15px] font-semibold tracking-[-.025em] text-central-carbon sm:text-[16px]">Métodos de pago</h3>
      <div className="mt-4 h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
              {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
            </Pie>
            <ChartValueTooltip metric="count" />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
