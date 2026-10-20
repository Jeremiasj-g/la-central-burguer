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

export function TopProductsBarChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
      <h3 className="text-[15px] font-semibold tracking-[-.025em] text-central-carbon sm:text-[16px]">Productos más vendidos</h3>
      <div className="mt-4 h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartMargins}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={76} angle={-28} textAnchor="end" tick={{ fontSize: 10, fill: "#737373" }} tickFormatter={(name: string) => name.length > 13 ? name.slice(0, 12) + "…" : name} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartValueTooltip metric="count" metricName="Unidades vendidas" />
            <Bar dataKey="value" fill={orange} radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
