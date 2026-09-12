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

function normalizeMetrics(metrics?: DashboardRpc['metrics']): MetricSummary[] {
  return (metrics ?? []).map((metric) => {
    const isDailySales = metric.label === 'Ventas del día';
    const hasRevenueBreakdown = metric.productRevenue !== undefined && metric.deliveryRevenue !== undefined;

    return {
      label: isDailySales && hasRevenueBreakdown ? 'Ventas del día + delivery' : metric.label,
      value: isDailySales || metric.label === 'Ticket promedio'
        ? formatCurrency(Number(metric.value))
        : String(metric.value),
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
