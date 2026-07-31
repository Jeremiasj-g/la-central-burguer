'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';

const colors = ['#E45712', '#C7440B', '#151515', '#8F8F8F', '#F2B38F'];

export function SalesByCategoryChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white p-6 shadow-soft">
      <h3 className="text-lg font-black text-central-carbon">Ventas por categoría</h3>
      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={4}>
              {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.map((item, index) => <span key={item.name} className="text-xs font-bold text-neutral-500"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }} />{item.name}</span>)}
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
