'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartValueTooltip } from './ChartValueTooltip';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';

const chartMargins = { top: 10, right: 20, left: 0, bottom: 0 };
const gridStroke = '#ece7df';
const orange = '#E45712';
const ember = '#C7440B';
const carbon = '#151515';

export function SalesByHourChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
      <h3 className="text-[15px] font-semibold tracking-[-.025em] text-central-carbon sm:text-[16px]">Horarios con más ventas</h3>
      <div className="mt-4 h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartMargins}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartValueTooltip metric="count" metricName="Pedidos" />
            <Bar dataKey="value" fill={ember} radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
