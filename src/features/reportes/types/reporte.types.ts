import type {
  DeliveryMethod,
  OrderStatus,
  PaymentMethodCode,
} from '@/lib/supabase/database.types';

export type ReportDatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'previousMonth'
  | 'allTime'
  | 'custom';

export type ReportStatusFilter = 'valid' | 'all' | 'aceptado' | 'cancelado';
export type ReportGroupBy = 'day' | 'week' | 'month' | 'category' | 'product' | 'payment' | 'delivery';

export interface ReportFilters {
  from: string;
  to: string;
  allTime: boolean;
  status: ReportStatusFilter;
  paymentMethod: 'all' | PaymentMethodCode;
  deliveryMethod: 'all' | DeliveryMethod;
  search: string;
}

export interface ReportOrder {
  id: string;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethodCode;
  subtotal: number;
  deliveryCost: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  orderId: string;
  productId: string | null;
  categoryId: string | null;
  productName: string;
  categoryName: string | null;
  isPromotion: boolean;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReportDataset {
  orders: ReportOrder[];
  items: ReportItem[];
}

export interface ReportSummary {
  netRevenue: number;
  validOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  averageTicket: number;
  unitsSold: number;
  deliveryRevenue: number;
  cancellationRate: number;
}

export interface ReportGroupRow {
  key: string;
  label: string;
  orders: number;
  cancelledOrders: number;
  units: number;
  revenue: number;
  deliveryRevenue: number;
  averageTicket: number;
  share: number;
}

export interface ReportTrendPoint {
  key: string;
  label: string;
  revenue: number;
  orders: number;
}

export interface ReportPresetRange {
  from: string;
  to: string;
}
