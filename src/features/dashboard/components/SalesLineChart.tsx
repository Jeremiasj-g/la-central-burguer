'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartValueTooltip, formatChartCurrencyAxis } from './ChartValueTooltip';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';

const chartMargins = { top: 10, right: 20, left: 0, bottom: 0 };
const gridStroke = '#ece7df';
const orange = '#E45712';
const ember = '#C7440B';
const carbon = '#151515';

export function SalesLineChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
      <h3 className="text-[15px] font-semibold tracking-[-.025em] text-central-carbon sm:text-[16px]">Evolución de ventas</h3>
      <div className="mt-4 h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={chartMargins}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737373" }} minTickGap={15} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={formatChartCurrencyAxis} width={72} tick={{ fontSize: 11, fill: "#737373" }} />
            <ChartValueTooltip metric="currency" metricName="Ventas" />
            <Line type="monotone" dataKey="value" stroke={orange} strokeWidth={3} dot={{ r: 4, fill: orange }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
