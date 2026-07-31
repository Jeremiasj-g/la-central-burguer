'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';
const colors = ['#E45712', '#151515', '#C7440B'];

export function PaymentMethodsChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white p-6 shadow-soft">
      <h3 className="text-lg font-black text-central-carbon">Métodos de pago</h3>
      <div className="mt-5 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
              {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
