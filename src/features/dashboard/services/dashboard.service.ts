import type { ChartPoint, DashboardStats, MetricSummary } from '../types/dashboard.types';
import { formatCurrency } from '@/shared/utils/format.utils';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Order } from '@/features/pedidos/types/pedido.types';

type DashboardRpc = {
  metrics?: Array<{ label: string; value: string | number; hint: string; trend: string }>;
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

function normalizeMetrics(metrics?: DashboardRpc['metrics']): MetricSummary[] {
  return (metrics ?? []).map((metric) => ({
    ...metric,
    value: ['Ventas del día', 'Ticket promedio'].includes(metric.label)
      ? formatCurrency(Number(metric.value))
      : String(metric.value),
  }));
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
    salesEvolution: normalizePoints(stats.salesEvolution),
    revenueByDay: normalizePoints(stats.revenueByDay),
    topProducts: normalizePoints(stats.topProducts),
    salesByCategory: normalizePoints(stats.salesByCategory),
    deliveryMethods: normalizePoints(stats.deliveryMethods),
    topPromotions: normalizePoints(stats.topPromotions),
    paymentMethods: normalizePoints(stats.paymentMethods),
    salesByHour: normalizePoints(stats.salesByHour),
    recentOrders: stats.recentOrders ?? [],
  };
}
