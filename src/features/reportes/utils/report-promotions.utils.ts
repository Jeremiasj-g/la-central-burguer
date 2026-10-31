import type { ReportDataset } from '../types/reporte.types';

export type PromotionGroupMode = 'campaign' | 'product';

export interface PromotionRow {
  key: string;
  label: string;
  subtitle: string;
  orders: number;
  units: number;
  revenue: number;
  savings: number;
  savingsUntrackedUnits: number;
  share: number;
}

export interface PromotionSummary {
  revenue: number;
  units: number;
  orders: number;
  savings: number;
  savingsUntrackedUnits: number;
  share: number;
  rows: PromotionRow[];
}

/**
 * Cuenta líneas promocionales realmente vendidas; excluye cancelaciones.
 * Nunca reconstruye precios originales a partir de precios ACTUALES del catálogo.
 * El ahorro es exacto solamente cuando existe snapshot de la venta.
 */
export function summarizePromotionSales(dataset: ReportDataset, groupBy: PromotionGroupMode): PromotionSummary {
  const validOrders = dataset.orders.filter(order => order.status !== 'cancelado');
  const validIds = new Set(validOrders.map(order => order.id));
  const subtotalProducts = validOrders.reduce((sum, order) => sum + order.subtotal, 0);
  const seenOrders = new Set<string>();
  const groups = new Map<string, {
    key: string; label: string; subtitle: string; orderIds: Set<string>;
    units: number; revenue: number; savings: number; savingsUntrackedUnits: number;
  }>();

  let revenue = 0;
  let units = 0;
  let savings = 0;
  let savingsUntrackedUnits = 0;

  for (const item of dataset.items) {
    if (!validIds.has(item.orderId) || (!item.isPromotion && !item.discountCampaignId)) continue;
    const tracked = item.originalUnitPrice !== null && item.discountPercent !== null
      && item.originalUnitPrice > item.unitPrice;
    const itemSavings = tracked ? (item.originalUnitPrice! - item.unitPrice) * item.quantity : 0;
    const untracked = tracked ? 0 : item.quantity;
    const descriptor = groupBy === 'campaign'
      ? {
          key: item.discountCampaignId ?? 'other',
          label: item.discountCampaignTitle ?? 'Otras promociones / histórico',
          subtitle: item.discountCampaignId ? `Campaña · ${item.discountPercent ?? 0}%` : 'Sin campaña identificada',
        }
      : {
          key: item.productId ?? `nombre:${item.productName}`,
          label: item.productName,
          subtitle: item.categoryName ?? 'Sin categoría',
        };
    const group = groups.get(descriptor.key) ?? {
      ...descriptor, orderIds: new Set<string>(),
      units: 0, revenue: 0, savings: 0, savingsUntrackedUnits: 0,
    };

    group.orderIds.add(item.orderId);
    group.units += item.quantity;
    group.revenue += item.total;
    group.savings += itemSavings;
    group.savingsUntrackedUnits += untracked;
    groups.set(group.key, group);

    seenOrders.add(item.orderId);
    units += item.quantity;
    revenue += item.total;
    savings += itemSavings;
    savingsUntrackedUnits += untracked;
  }

  const rows = [...groups.values()].map(group => ({
    key: group.key, label: group.label, subtitle: group.subtitle,
    orders: group.orderIds.size, units: group.units, revenue: group.revenue,
    savings: group.savings, savingsUntrackedUnits: group.savingsUntrackedUnits,
    share: revenue > 0 ? group.revenue / revenue : 0,
  })).sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));

  return { revenue, units, orders: seenOrders.size, savings, savingsUntrackedUnits,
    share: subtotalProducts > 0 ? revenue / subtotalProducts : 0, rows };
}
