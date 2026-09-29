import type { ChartPoint } from '@/features/dashboard/types/dashboard.types';
import type { ReportDataset, ReportFilters } from '../types/reporte.types';

export type ReportChartGranularity = 'day' | 'week' | 'month';

export interface ReportChartData {
  salesEvolution: ChartPoint[];
  revenueByDay: ChartPoint[];
  topProducts: ChartPoint[];
  salesByCategory: ChartPoint[];
  deliveryMethods: ChartPoint[];
  topPromotions: ChartPoint[];
  paymentMethods: ChartPoint[];
  salesByHour: ChartPoint[];
  granularity: ReportChartGranularity;
}

function parseFilterDate(value: string, endOfDay = false) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const weekday = result.getDay();
  result.setDate(result.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function differenceInDays(from: Date, to: Date) {
  return Math.max(0, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000));
}

function getDatasetRange(dataset: ReportDataset, filters: ReportFilters) {
  if (!filters.allTime && filters.from && filters.to) {
    return {
      from: parseFilterDate(filters.from),
      to: parseFilterDate(filters.to, true),
    };
  }

  if (!dataset.orders.length) {
    const today = new Date();
    return { from: startOfDay(today), to: today };
  }

  const timestamps = dataset.orders.map((order) => new Date(order.createdAt).getTime());
  return {
    from: new Date(Math.min(...timestamps)),
    to: new Date(Math.max(...timestamps)),
  };
}

function getGranularity(from: Date, to: Date): ReportChartGranularity {
  const days = differenceInDays(from, to);
  if (days <= 45) return 'day';
  if (days <= 240) return 'week';
  return 'month';
}

function bucketStart(date: Date, granularity: ReportChartGranularity) {
  if (granularity === 'week') return startOfWeek(date);
  if (granularity === 'month') return startOfMonth(date);
  return startOfDay(date);
}

function bucketKey(date: Date, granularity: ReportChartGranularity) {
  const start = bucketStart(date, granularity);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${year}-${month}`;
  const day = String(start.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function bucketLabel(date: Date, granularity: ReportChartGranularity) {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' })
      .format(date)
      .replace('.', '');
  }

  if (granularity === 'week') {
    return `Sem. ${new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(date)}`;
  }

  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(date);
}

function incrementBucket(date: Date, granularity: ReportChartGranularity) {
  const next = new Date(date);
  if (granularity === 'month') next.setMonth(next.getMonth() + 1);
  else if (granularity === 'week') next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + 1);
  return next;
}

function buildTimeline(dataset: ReportDataset, filters: ReportFilters) {
  const range = getDatasetRange(dataset, filters);
  const granularity = getGranularity(range.from, range.to);
  const values = new Map<string, { revenue: number; orders: number }>();

  for (const order of dataset.orders) {
    const key = bucketKey(new Date(order.createdAt), granularity);
    const current = values.get(key) ?? { revenue: 0, orders: 0 };
    current.revenue += order.total;
    current.orders += 1;
    values.set(key, current);
  }

  const points: ChartPoint[] = [];
  let cursor = bucketStart(range.from, granularity);
  const last = bucketStart(range.to, granularity);

  while (cursor <= last) {
    const key = bucketKey(cursor, granularity);
    const current = values.get(key) ?? { revenue: 0, orders: 0 };
    points.push({
      name: bucketLabel(cursor, granularity),
      value: current.revenue,
      revenue: current.revenue,
      orders: current.orders,
    });
    cursor = incrementBucket(cursor, granularity);
  }

  return { points, granularity };
}

function aggregateItems(
  dataset: ReportDataset,
  selector: (item: ReportDataset['items'][number]) => string | null,
  metric: 'quantity' | 'revenue',
  onlyPromotions = false,
  limit?: number,
) {
  const totals = new Map<string, number>();

  for (const item of dataset.items) {
    if (onlyPromotions && !item.isPromotion) continue;
    const key = selector(item);
    if (!key) continue;
    const value = metric === 'quantity' ? item.quantity : item.total;
    totals.set(key, (totals.get(key) ?? 0) + value);
  }

  const rows = [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

function aggregateOrders(
  dataset: ReportDataset,
  selector: (order: ReportDataset['orders'][number]) => string,
) {
  const totals = new Map<string, number>();
  for (const order of dataset.orders) {
    const key = selector(order);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals.entries()].map(([name, value]) => ({ name, value }));
}

export function buildReportChartData(
  dataset: ReportDataset,
  filters: ReportFilters,
): ReportChartData {
  const timeline = buildTimeline(dataset, filters);

  const deliveryCounts = aggregateOrders(
    dataset,
    (order) => order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro local',
  );
  const deliveryTotal = deliveryCounts.reduce((total, item) => total + item.value, 0);
  const deliveryMethods = deliveryCounts.map((item) => ({
    ...item,
    value: deliveryTotal ? Math.round((item.value / deliveryTotal) * 1000) / 10 : 0,
  }));

  const paymentMethods = aggregateOrders(
    dataset,
    (order) => order.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo',
  );

  const hours = new Map<number, number>();
  for (const order of dataset.orders) {
    const hour = new Date(order.createdAt).getHours();
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }

  const salesByHour = [...hours.entries()]
    .sort(([left], [right]) => left - right)
    .map(([hour, value]) => ({
      name: `${String(hour).padStart(2, '0')}hs`,
      value,
    }));

  return {
    salesEvolution: timeline.points,
    revenueByDay: timeline.points,
    topProducts: aggregateItems(dataset, (item) => item.productName, 'quantity', false, 8),
    salesByCategory: aggregateItems(dataset, (item) => item.categoryName ?? 'Sin categoría', 'revenue'),
    deliveryMethods,
    topPromotions: aggregateItems(dataset, (item) => item.productName, 'quantity', true, 8),
    paymentMethods,
    salesByHour,
    granularity: timeline.granularity,
  };
}

export function getGranularityLabel(granularity: ReportChartGranularity) {
  if (granularity === 'week') return 'semana';
  if (granularity === 'month') return 'mes';
  return 'día';
}
