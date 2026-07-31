import type { Order } from '@/features/pedidos/types/pedido.types';

export interface MetricSummary {
  label: string;
  value: string;
  hint: string;
  trend: string;
}

export interface ChartPoint {
  name: string;
  value: number;
  revenue?: number;
  orders?: number;
}

export interface DashboardStats {
  metrics: MetricSummary[];
  salesEvolution: ChartPoint[];
  revenueByDay: ChartPoint[];
  topProducts: ChartPoint[];
  salesByCategory: ChartPoint[];
  deliveryMethods: ChartPoint[];
  topPromotions: ChartPoint[];
  paymentMethods: ChartPoint[];
  salesByHour: ChartPoint[];
  recentOrders: Order[];
}
