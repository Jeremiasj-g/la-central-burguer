'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReportDataset } from '../types/reporte.types';
import { formatCurrency, getDailyTrend, groupReport } from '../utils/reportes.utils';

interface ReportChartsProps {
  dataset: ReportDataset;
}

const PIE_COLORS = ['#D88918', '#2F2B27', '#A65F08', '#7C7369'];

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-sm border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 min-w-0">
        <h3 className="break-words text-base font-extrabold text-central-carbon">{title}</h3>
        <p className="mt-1 break-words text-xs leading-5 text-neutral-500">{description}</p>
      </div>
      <div className="h-72 min-w-0 overflow-hidden">{children}</div>
    </article>
  );
}

export function ReportCharts({ dataset }: ReportChartsProps) {
  const trend = getDailyTrend(dataset);
  const products = groupReport(dataset, 'product').slice(0, 8).map((row) => ({ name: row.label, ventas: row.revenue }));
  const categories = groupReport(dataset, 'category').slice(0, 7).map((row) => ({ name: row.label, ventas: row.revenue }));
  const payment = groupReport(dataset, 'payment').map((row) => ({ name: row.label, value: row.revenue }));

  return (
    <section className="mb-6 grid min-w-0 gap-5 xl:grid-cols-2">
      <ChartCard title="Evolución de facturación" description="Facturación neta diaria dentro del período seleccionado.">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece8e1" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#77716a' }} axisLine={false} tickLine={false} />
            <YAxis width={48} tick={{ fontSize: 11, fill: '#77716a' }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Facturación']} labelStyle={{ color: '#11100F', fontWeight: 700 }} />
            <Line type="monotone" dataKey="revenue" stroke="#D88918" strokeWidth={3} dot={{ r: 3, fill: '#D88918' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Productos con mayor facturación" description="Top de productos según importe vendido, excluyendo cancelaciones.">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={products} layout="vertical" margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece8e1" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#77716a' }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
            <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10, fill: '#5f5952' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Facturación']} />
            <Bar dataKey="ventas" fill="#D88918" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ventas por categoría" description="Participación de cada categoría en la facturación de productos.">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={categories} margin={{ top: 8, right: 8, left: 0, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece8e1" vertical={false} />
            <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={64} tick={{ fontSize: 10, fill: '#5f5952' }} axisLine={false} tickLine={false} />
            <YAxis width={48} tick={{ fontSize: 10, fill: '#77716a' }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Facturación']} />
            <Bar dataKey="ventas" fill="#2F2B27" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Participación por método de pago" description="Distribución de facturación entre efectivo y transferencia.">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie data={payment} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={3}>
              {payment.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}
