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
export type ReportSource = 'web' | 'admin' | 'import';
export type ReportSourceFilter = 'all' | ReportSource;
export type ReportGroupBy = 'day' | 'week' | 'month' | 'category' | 'product' | 'payment' | 'delivery' | 'source';

export interface ReportFilters {
  from: string;
  to: string;
  allTime: boolean;
  status: ReportStatusFilter;
  paymentMethod: 'all' | PaymentMethodCode | 'combinado';
  deliveryMethod: 'all' | DeliveryMethod;
  source?: ReportSourceFilter;
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
  paymentPreference: PaymentMethodCode | 'combinado';
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
  /** Historical snapshot, or current catalog fallback for older sales. */
  categoryNameSource: 'sale_snapshot' | 'current_catalog' | 'missing';
  imageUrl: string | null;
  isPromotion: boolean;
  /** Historical snapshot: null for sales before snapshot tracking. */
  discountCampaignId: string | null;
  discountCampaignTitle: string | null;
  discountPercent: number | null;
  originalUnitPrice: number | null;
  /** Cost captured for this sale, never the current recipe cost. */
  unitCostSnapshot: number | null;
  totalCostSnapshot: number | null;
  costSnapshotStatus: 'complete' | 'missing' | null;
  costSnapshotSource: 'order_insert' | 'order_edit' | 'backfill_current' | 'backfill_client_confirmed' | null;
  quantity: number;
  unitPrice: number;
  total: number;
  note: string | null;
  createdAt: string;
}

export interface ReportSettledDeliveryCommission {
  settlementId: string;
  assignmentId: string;
  orderId: string;
  commissionPercent: number;
  deliveryFee: number;
  amount: number;
  paidAt: string | null;
}

export interface ReportDataset {
  orders: ReportOrder[];
  items: ReportItem[];
  settledDeliveryCommissions: ReportSettledDeliveryCommission[];
}

export interface ReportOrdersPage {
  orders: ReportOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportSummary {
  grossRevenue: number;
  netRevenue: number;
  settledDeliveryCommission: number;
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
