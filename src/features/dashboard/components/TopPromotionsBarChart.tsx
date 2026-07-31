'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';

export function TopPromotionsBarChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white p-6 shadow-soft">
      <h3 className="text-lg font-black text-central-carbon">Promociones más vendidas</h3>
      <div className="mt-5 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ece7df" strokeDasharray="4 4" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#D88918" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
