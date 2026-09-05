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
  customerEmail: string | null;
  deliveryMethod: DeliveryMethod;
  address: string | null;
  customerLatitude: number | null;
  customerLongitude: number | null;
  deliveryDistanceKm: number | null;
  deliveryMapsUrl: string | null;
  paymentMethod: PaymentMethodCode;
  subtotal: number;
  deliveryCost: number;
  total: number;
  status: OrderStatus;
  notes: string | null;
  source: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportItem {
  id: string;
  orderId: string;
  productId: string | null;
  categoryId: string | null;
  productName: string;
  categoryName: string | null;
  imageUrl: string | null;
  isPromotion: boolean;
  quantity: number;
  unitPrice: number;
  total: number;
  note: string | null;
  createdAt: string;
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

export interface ReportPresetRange {
  from: string;
  to: string;
}
