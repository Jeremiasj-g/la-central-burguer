'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';

const chartMargins = { top: 10, right: 20, left: 0, bottom: 0 };
const gridStroke = '#ece7df';
const orange = '#E45712';
const ember = '#C7440B';
const carbon = '#151515';

export function SalesLineChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white p-6 shadow-soft">
      <h3 className="text-lg font-black text-central-carbon">Evolución de ventas</h3>
      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={chartMargins}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => `$${Number(value).toLocaleString('es-AR')}`} />
            <Line type="monotone" dataKey="value" stroke={orange} strokeWidth={3} dot={{ r: 4, fill: orange }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
