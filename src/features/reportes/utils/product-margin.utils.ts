import type { ReportDataset, ReportItem } from '../types/reporte.types';

export interface ProductMarginRow {
  key: string;
  productId: string | null;
  productName: string;
  categoryName: string;
  units: number;
  sales: number;
  cost: number;
  margin: number;
  marginPercent: number;
  missingUnits: number;
  missingSales: number;
  estimatedUnits: number;
  knownUnits: number;
  /** Costo por unidad, sólo cuando todas las unidades tienen costo consistente. */
  unitCost: number | null;
  /** Precio promedio realmente vendido; promociones/descuentos incluidos. */
  averageSalePrice: number;
}

export interface ProductMarginSummary {
  revenue: number;
  cost: number;
  grossMargin: number;
  marginPercent: number;
  coveredRevenue: number;
  uncoveredRevenue: number;
  coveredUnits: number;
  uncoveredUnits: number;
  estimatedUnits: number;
  complete: boolean;
}

export interface ProductMarginAnalysis {
  rows: ProductMarginRow[];
  summary: ProductMarginSummary;
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function analyzeProductMargins(dataset: ReportDataset): ProductMarginAnalysis {
  const validOrders = new Set(dataset.orders.filter(order => order.status !== 'cancelado').map(order => order.id));
  const rows = new Map<string, ProductMarginRow>();
  let revenue = 0;
  let cost = 0;
  let coveredRevenue = 0;
  let uncoveredRevenue = 0;
  let coveredUnits = 0;
  let uncoveredUnits = 0;
  let estimatedUnits = 0;

  for (const item of dataset.items) {
    if (!validOrders.has(item.orderId)) continue;
    const key = item.productId ?? `sin-id:${item.productName}:${item.categoryName ?? ''}`;
    const lineRevenue = Number(item.total);
    const known = item.costSnapshotStatus === 'complete'
      && item.totalCostSnapshot !== null
      && item.unitCostSnapshot !== null
      && Number.isFinite(item.totalCostSnapshot)
      && Number.isFinite(item.unitCostSnapshot);
    const lineCost = known ? Number(item.totalCostSnapshot) : 0;
    revenue += lineRevenue;
    if (known) {
      cost += lineCost;
      coveredRevenue += lineRevenue;
      coveredUnits += item.quantity;
      if (item.costSnapshotSource === 'backfill_current') estimatedUnits += item.quantity;
    } else {
      uncoveredRevenue += lineRevenue;
      uncoveredUnits += item.quantity;
    }
    const current = rows.get(key) ?? {
      key, productId: item.productId, productName: item.productName,
      categoryName: item.categoryName ?? 'Sin categoría',
      units: 0, sales: 0, cost: 0, margin: 0, marginPercent: 0,
      missingUnits: 0, missingSales: 0, estimatedUnits: 0,
      knownUnits: 0, unitCost: null, averageSalePrice: 0,
    };
    current.units += item.quantity;
    current.sales += lineRevenue;
    current.cost += lineCost;
    if (!known) {
      current.missingUnits += item.quantity;
      current.missingSales += lineRevenue;
    } else {
      current.knownUnits += item.quantity;
      if (item.costSnapshotSource === 'backfill_current') current.estimatedUnits += item.quantity;
    }
    rows.set(key, current);
  }

  const output = [...rows.values()].map(row => {
    const knownRevenue = row.sales - row.missingSales;
    const margin = knownRevenue - row.cost;
    return {
      ...row,
      cost: round(row.cost),
      sales: round(row.sales),
      margin: round(margin),
      marginPercent: knownRevenue > 0 ? margin / knownRevenue * 100 : 0,
      unitCost: row.missingUnits === 0 && row.knownUnits > 0 ? round(row.cost / row.knownUnits) : null,
      averageSalePrice: row.units > 0 ? round(row.sales / row.units) : 0,
    };
  }).sort((a,b)=>b.margin-a.margin || a.productName.localeCompare(b.productName,'es'));

  return {
    rows: output,
    summary: {
      revenue: round(revenue),
      cost: round(cost),
      grossMargin: round(coveredRevenue - cost),
      marginPercent: coveredRevenue > 0 ? (coveredRevenue-cost)/coveredRevenue*100 : 0,
      coveredRevenue: round(coveredRevenue),
      uncoveredRevenue: round(uncoveredRevenue),
      coveredUnits, uncoveredUnits, estimatedUnits,
      complete: uncoveredUnits === 0,
    },
  };
}

/** Una fila por línea vendida: base limpia para tablas dinámicas de Excel. */
export function buildProductMarginExportRows(dataset: ReportDataset) {
  const orders = new Map(dataset.orders.map(order => [order.id, order]));
  return dataset.items.map((item: ReportItem) => {
    const order = orders.get(item.orderId);
    if (!order) return null;
    const isValid = order.status !== 'cancelado';
    const hasCost = item.costSnapshotStatus === 'complete'
      && item.totalCostSnapshot !== null && item.unitCostSnapshot !== null;
    const productSale = isValid ? item.total : 0;
    const productCost = isValid && hasCost ? item.totalCostSnapshot! : null;
    return {
      fecha: order.createdAt.slice(0,10),
      pedido: order.orderCode,
      productoId: item.productId ?? '',
      producto: item.productName,
      categoria: item.categoryName ?? 'Sin categoría',
      origen: order.source,
      estado: order.status,
      valido: isValid ? 'Sí' : 'No',
      cantidad: isValid ? item.quantity : 0,
      unitario: item.unitPrice,
      ingreso: productSale,
      costoUnitario: hasCost ? item.unitCostSnapshot : null,
      costo: productCost,
      margen: productCost !== null ? round(productSale-productCost) : null,
      margenPorcentaje: productCost !== null && productSale > 0 ? (productSale-productCost)/productSale : null,
      cobertura: hasCost ? 'Completo' : 'Sin costo',
      fuente: item.costSnapshotSource ?? 'Sin captura histórica',
      promocion: item.isPromotion ? 'Sí' : 'No',
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
}
