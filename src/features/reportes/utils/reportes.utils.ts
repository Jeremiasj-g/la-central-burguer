import type {
  ReportDataset,
  ReportDatePreset,
  ReportGroupBy,
  ReportGroupRow,
  ReportPresetRange,
  ReportSummary,
  ReportTrendPoint,
} from '../types/reporte.types';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('es-AR');

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatReportDate(value: string | Date) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export function formatReportDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function getPresetRange(preset: ReportDatePreset, now = new Date()): ReportPresetRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(today);
  const to = new Date(today);

  if (preset === 'yesterday') {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  }

  if (preset === 'last7') from.setDate(from.getDate() - 6);
  if (preset === 'last30') from.setDate(from.getDate() - 29);

  if (preset === 'thisMonth') {
    from.setDate(1);
  }

  if (preset === 'previousMonth') {
    from.setMonth(from.getMonth() - 1, 1);
    to.setDate(0);
  }

  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  };
}

export function getReportSummary(dataset: ReportDataset): ReportSummary {
  const validOrders = dataset.orders.filter((order) => order.status !== 'cancelado');
  const cancelledOrders = dataset.orders.filter((order) => order.status === 'cancelado');
  const validIds = new Set(validOrders.map((order) => order.id));
  const validItems = dataset.items.filter((item) => validIds.has(item.orderId));
  const netRevenue = validOrders.reduce((total, order) => total + order.total, 0);
  const deliveryRevenue = validOrders.reduce((total, order) => total + order.deliveryCost, 0);
  const totalOrders = dataset.orders.length;

  return {
    netRevenue,
    validOrders: validOrders.length,
    cancelledOrders: cancelledOrders.length,
    totalOrders,
    averageTicket: validOrders.length ? netRevenue / validOrders.length : 0,
    unitsSold: validItems.reduce((total, item) => total + item.quantity, 0),
    deliveryRevenue,
    cancellationRate: totalOrders ? cancelledOrders.length / totalOrders : 0,
  };
}

interface MutableGroup {
  key: string;
  label: string;
  orderIds: Set<string>;
  cancelledOrders: number;
  units: number;
  revenue: number;
  deliveryRevenue: number;
}

function startOfWeek(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = copy.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function orderGroupDescriptor(createdAt: string, groupBy: ReportGroupBy, payment: string, delivery: string) {
  const date = new Date(createdAt);

  if (groupBy === 'day') {
    const key = formatDateInput(date);
    return { key, label: formatReportDate(date) };
  }

  if (groupBy === 'week') {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      key: formatDateInput(start),
      label: `${formatReportDate(start)} — ${formatReportDate(end)}`,
    };
  }

  if (groupBy === 'month') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
    return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }

  if (groupBy === 'payment') {
    return { key: payment, label: payment === 'transferencia' ? 'Transferencia' : 'Efectivo' };
  }

  return { key: delivery, label: delivery === 'delivery' ? 'Delivery' : 'Retiro local' };
}

function toGroupRows(groups: Map<string, MutableGroup>, totalRevenue: number): ReportGroupRow[] {
  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      label: group.label,
      orders: group.orderIds.size,
      cancelledOrders: group.cancelledOrders,
      units: group.units,
      revenue: group.revenue,
      deliveryRevenue: group.deliveryRevenue,
      averageTicket: group.orderIds.size ? group.revenue / group.orderIds.size : 0,
      share: totalRevenue ? group.revenue / totalRevenue : 0,
    }))
    .sort((a, b) => {
      const chronological = /^\d{4}-\d{2}/.test(a.key) && /^\d{4}-\d{2}/.test(b.key);
      return chronological ? a.key.localeCompare(b.key) : b.revenue - a.revenue;
    });
}

export function groupReport(dataset: ReportDataset, groupBy: ReportGroupBy): ReportGroupRow[] {
  const validOrders = dataset.orders.filter((order) => order.status !== 'cancelado');
  const validIds = new Set(validOrders.map((order) => order.id));
  const totalRevenue = validOrders.reduce((total, order) => total + order.total, 0);
  const unitsByOrder = new Map<string, number>();

  for (const item of dataset.items) {
    if (!validIds.has(item.orderId)) continue;
    unitsByOrder.set(item.orderId, (unitsByOrder.get(item.orderId) ?? 0) + item.quantity);
  }

  if (groupBy === 'product' || groupBy === 'category') {
    const groups = new Map<string, MutableGroup>();

    for (const item of dataset.items) {
      if (!validIds.has(item.orderId)) continue;
      const key = groupBy === 'product' ? (item.productId ?? item.productName) : (item.categoryId ?? item.categoryName ?? 'sin-categoria');
      const label = groupBy === 'product' ? item.productName : (item.categoryName ?? 'Sin categoría');
      const current = groups.get(key) ?? {
        key,
        label,
        orderIds: new Set<string>(),
        cancelledOrders: 0,
        units: 0,
        revenue: 0,
        deliveryRevenue: 0,
      };
      current.orderIds.add(item.orderId);
      current.units += item.quantity;
      current.revenue += item.total;
      groups.set(key, current);
    }

    const itemRevenue = [...groups.values()].reduce((total, group) => total + group.revenue, 0);
    return toGroupRows(groups, itemRevenue);
  }

  const groups = new Map<string, MutableGroup>();
  for (const order of dataset.orders) {
    const descriptor = orderGroupDescriptor(order.createdAt, groupBy, order.paymentMethod, order.deliveryMethod);
    const current = groups.get(descriptor.key) ?? {
      ...descriptor,
      orderIds: new Set<string>(),
      cancelledOrders: 0,
      units: 0,
      revenue: 0,
      deliveryRevenue: 0,
    };

    if (order.status === 'cancelado') {
      current.cancelledOrders += 1;
    } else {
      current.orderIds.add(order.id);
      current.units += unitsByOrder.get(order.id) ?? 0;
      current.revenue += order.total;
      current.deliveryRevenue += order.deliveryCost;
    }
    groups.set(descriptor.key, current);
  }

  return toGroupRows(groups, totalRevenue);
}

export function getDailyTrend(dataset: ReportDataset): ReportTrendPoint[] {
  return groupReport(dataset, 'day').map((row) => ({
    key: row.key,
    label: row.label.slice(0, 5),
    revenue: row.revenue,
    orders: row.orders,
  }));
}

export const REPORT_GROUP_LABELS: Record<ReportGroupBy, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  category: 'Categoría',
  product: 'Producto',
  payment: 'Método de pago',
  delivery: 'Tipo de entrega',
};
