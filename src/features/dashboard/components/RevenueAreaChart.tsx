'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartPoint } from '../types/dashboard.types';
import { DashboardPeriodNote } from './DashboardPeriodNote';

const chartMargins = { top: 10, right: 20, left: 0, bottom: 0 };
const gridStroke = '#ece7df';
const orange = '#E45712';
const ember = '#C7440B';
const carbon = '#151515';

export function RevenueAreaChart({ data, periodLabel }: { data: ChartPoint[]; periodLabel: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white p-6 shadow-soft">
      <h3 className="text-lg font-black text-central-carbon">Ingresos por día</h3>
      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={chartMargins}>
            <defs>
              <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={orange} stopOpacity={0.35}/>
                <stop offset="95%" stopColor={orange} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => `$${Number(value).toLocaleString('es-AR')}`} />
            <Area type="monotone" dataKey="revenue" stroke={orange} fill="url(#revenue)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DashboardPeriodNote>{periodLabel}</DashboardPeriodNote>
    </div>
  );
}
