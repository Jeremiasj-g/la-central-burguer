import type { ChartPoint, DashboardStats, MetricSummary } from '../types/dashboard.types';
import { formatCurrency } from '@/shared/utils/format.utils';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Order } from '@/features/pedidos/types/pedido.types';

type DashboardRpc = {
  metrics?: Array<{
    label: string;
    value: string | number;
    hint: string;
    trend: string;
    productRevenue?: string | number;
    deliveryRevenue?: string | number;
  }>;
  salesEvolution?: ChartPoint[];
  revenueByDay?: ChartPoint[];
  topProducts?: ChartPoint[];
  salesByCategory?: ChartPoint[];
  deliveryMethods?: ChartPoint[];
  topPromotions?: ChartPoint[];
  paymentMethods?: ChartPoint[];
  salesByHour?: ChartPoint[];
  recentOrders?: Order[];
};

function normalizePoints(points?: ChartPoint[]) {
  return (points ?? []).map((point) => ({
    ...point,
    value: Number(point.value),
    ...(point.revenue !== undefined ? { revenue: Number(point.revenue) } : {}),
    ...(point.orders !== undefined ? { orders: Number(point.orders) } : {}),
  }));
}

const weekdaysEsAr: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue',
  fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

function localizeDashboardWeekday(label: string) {
  return weekdaysEsAr[label.trim().slice(0, 3).toLowerCase()] ?? label;
}

/**
 * get_dashboard_stats entrega cantidades absolutas en deliveryMethods.
 * El donut necesita porcentajes, pero conserva también el conteo real en orders.
 * No afecta las ventas ni actualiza datos en Supabase.
 */
function normalizeDeliveryMethods(points?: ChartPoint[]): ChartPoint[] {
  const rows = normalizePoints(points);
  const totalOrders = rows.reduce((total, row) => total + row.value, 0);

  return rows.map((row) => ({
    ...row,
    orders: row.value,
    value: totalOrders > 0 ? Math.round((row.value / totalOrders) * 1000) / 10 : 0,
  }));
}

function normalizeMetrics(metrics?: DashboardRpc['metrics']): MetricSummary[] {
  return (metrics ?? []).map((metric) => {
    const isDailySales = metric.label === 'Ventas del día';
    const hasRevenueBreakdown = metric.productRevenue !== undefined && metric.deliveryRevenue !== undefined;
    const numericValue = Number(metric.value);
    const valueKind = isDailySales || metric.label === 'Ticket promedio' ? 'currency' : 'number';

    return {
      label: isDailySales && hasRevenueBreakdown ? 'Ventas del día + delivery' : metric.label,
      value: valueKind === 'currency' ? formatCurrency(numericValue) : String(metric.value),
      numericValue,
      valueKind,
      hint: isDailySales && hasRevenueBreakdown
        ? `Productos ${formatCurrency(Number(metric.productRevenue))} + delivery ${formatCurrency(Number(metric.deliveryRevenue))}`
        : metric.hint,
      trend: metric.trend,
    };
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  requireSupabaseConfigured('cargar el dashboard');

  const { data, error } = await getSupabaseBrowserClient().rpc('get_dashboard_stats', {
    days_back: 30,
  });

  if (error) throw new Error(error.message);

  const stats = (data ?? {}) as unknown as DashboardRpc;
  return {
    metrics: normalizeMetrics(stats.metrics),
    salesEvolution: normalizePoints(stats.salesEvolution).map((point) => ({ ...point, name: localizeDashboardWeekday(point.name) })),
    revenueByDay: normalizePoints(stats.revenueByDay),
    topProducts: normalizePoints(stats.topProducts),
    salesByCategory: normalizePoints(stats.salesByCategory),
    deliveryMethods: normalizeDeliveryMethods(stats.deliveryMethods),
    topPromotions: normalizePoints(stats.topPromotions),
    paymentMethods: normalizePoints(stats.paymentMethods),
    salesByHour: normalizePoints(stats.salesByHour),
    recentOrders: stats.recentOrders ?? [],
  };
}
