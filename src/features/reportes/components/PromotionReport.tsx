'use client';

import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/shared/components/ui/Select';
import { TablePagination } from '@/shared/components/ui/TablePagination';
import type { ReportDataset } from '../types/reporte.types';
import { formatCurrency, formatNumber, formatReportDateTime } from '../utils/reportes.utils';
import { summarizePromotionSales, type PromotionGroupMode, type PromotionScope } from '../utils/report-promotions.utils';

const PAGE_SIZE = 10;

export function PromotionReport({ dataset }: { dataset: ReportDataset }) {
  const [groupBy, setGroupBy] = useState<PromotionGroupMode>('campaign');
  const [scope, setScope] = useState<PromotionScope>('all');
  const [detailView, setDetailView] = useState(false);
  const [page, setPage] = useState(1);
  const allSales = useMemo(() => summarizePromotionSales(dataset, 'campaign'), [dataset]);
  const categoryCampaigns = useMemo(() => summarizePromotionSales(dataset, 'campaign', 'campaign'), [dataset]);
  const otherPromotions = useMemo(() => summarizePromotionSales(dataset, 'campaign', 'other'), [dataset]);
  const summary = useMemo(() => summarizePromotionSales(dataset, groupBy, scope), [dataset, groupBy, scope]);
  const soldLines = useMemo(() => {
    const ordersById = new Map(dataset.orders.filter(order => order.status !== 'cancelado').map(order => [order.id, order]));
    return dataset.items.flatMap(item => {
      const order = ordersById.get(item.orderId);
      if (!order || (!item.isPromotion && !item.discountCampaignId)) return [];
      if (scope === 'campaign' && !item.discountCampaignId) return [];
      if (scope === 'other' && item.discountCampaignId) return [];
      return [{ item, order }];
    }).sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt));
  }, [dataset, scope]);
  useEffect(() => setPage(1), [dataset, groupBy, scope, detailView]);
  const visibleRows = summary.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleLines = soldLines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <p className="text-[13px] font-semibold text-neutral-900">Facturación real de promociones</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">Importes cobrados al vender, no precios actuales del catálogo. Se aplican los filtros del informe.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="inline-flex rounded-[10px] bg-neutral-100 p-1">
            <button type="button" aria-pressed={!detailView} onClick={() => setDetailView(false)}
              className={`rounded-[8px] px-3 py-1.5 text-[11px] font-medium transition-colors ${!detailView ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
              Agrupado
            </button>
            <button type="button" aria-pressed={detailView} onClick={() => setDetailView(true)}
              className={`rounded-[8px] px-3 py-1.5 text-[11px] font-medium transition-colors ${detailView ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
              Cada venta
            </button>
          </div>
          {!detailView ? (
            <div className="min-w-[150px] flex-1 sm:w-44 sm:flex-none">
              <Select aria-label="Agrupar ofertas" variant="light" value={groupBy}
                options={[{value:'campaign',label:'Por campaña'}, {value:'product',label:'Por producto'}]}
                onValueChange={(value) => setGroupBy(value as PromotionGroupMode)}
                className="!h-9 !rounded-[10px] !border-neutral-200 !bg-[#f8f8f9] !text-[12px] !font-medium !shadow-none" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-5 border-b border-neutral-100 px-5 py-5 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-neutral-500">Total facturado en ofertas</p>
          <p className="mt-1 text-[clamp(1.8rem,3vw,2.5rem)] font-semibold tracking-[-.05em] tabular-nums text-neutral-950">
            {formatCurrency(allSales.revenue)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Suma de los precios realmente cobrados, sin envíos</p>
        </div>
        <div className="min-w-0 sm:border-l sm:border-neutral-100 sm:pl-5">
          <p className="text-[11px] text-neutral-500">Campañas de descuento</p>
          <p className="mt-1 text-[clamp(1.35rem,2vw,1.8rem)] font-semibold tracking-tight tabular-nums text-[#b97625]">
            {formatCurrency(categoryCampaigns.revenue)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Campañas identificadas al vender</p>
        </div>
        <div className="min-w-0 sm:border-l sm:border-neutral-100 sm:pl-5">
          <p className="text-[11px] text-neutral-500">Otras promociones</p>
          <p className="mt-1 text-[clamp(1.35rem,2vw,1.8rem)] font-semibold tracking-tight tabular-nums text-neutral-900">
            {formatCurrency(otherPromotions.revenue)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Productos promocionales sin campaña asociada</p>
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-3 border-t border-neutral-100 pt-4 text-[12px] sm:col-span-2 xl:col-span-3">
          <span className="text-neutral-500">Unidades en oferta <strong className="ml-1 font-semibold tabular-nums text-neutral-900">{formatNumber(allSales.units)}</strong></span>
          <span className="text-neutral-500">Pedidos con oferta <strong className="ml-1 font-semibold tabular-nums text-neutral-900">{formatNumber(allSales.orders)}</strong></span>
          <span className="text-neutral-500">Participación en ventas de productos <strong className="ml-1 font-semibold tabular-nums text-neutral-900">{(allSales.share * 100).toFixed(1)}%</strong></span>
          <span className="text-neutral-500">Ahorro comprobado <strong className="ml-1 font-semibold tabular-nums text-emerald-700">{formatCurrency(allSales.savings)}</strong></span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 px-5 py-3">
        <span className="text-[11px] font-medium text-neutral-500">Mostrar ventas</span>
        {([
          ['all', 'Todas'],
          ['campaign', 'Campañas'],
          ['other', 'Otras promos'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={scope === value}
            onClick={() => setScope(value)}
            className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${scope === value ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-neutral-400">Facturado en la selección: <strong className="font-semibold tabular-nums text-neutral-800">{formatCurrency(summary.revenue)}</strong></span>
      </div>

      <div className="overflow-x-auto">
        {detailView ? (
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-5 py-3">Fecha de venta</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Campaña / promoción</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">Precio cobrado por unidad</th>
                <th className="px-5 py-3 text-right">Total facturado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visibleLines.map(({ item, order }) => (
                <tr key={item.id} className="transition hover:bg-neutral-50/70">
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{formatReportDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3.5 font-medium text-neutral-700">{order.orderCode}</td>
                  <td className="px-4 py-3.5 font-medium text-neutral-900">{item.productName}</td>
                  <td className="px-4 py-3.5 text-neutral-500">{item.discountCampaignTitle ?? 'Otra promoción'}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-neutral-600">{formatNumber(item.quantity)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-neutral-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-3">{groupBy === 'campaign' ? 'Campaña / promoción' : 'Producto'}</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              {groupBy === 'product' ? <th className="px-4 py-3 text-right">Precio medio cobrado</th> : null}
              <th className="px-4 py-3 text-right">Facturación real</th>
              <th className="px-4 py-3 text-right">Ahorro registrado</th>
              <th className="px-4 py-3 text-right">Sin dato de ahorro</th>
              <th className="px-5 py-3 text-right">Participación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visibleRows.map(row => (
              <tr key={row.key} className="transition hover:bg-neutral-50/70">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-neutral-900">{row.label}</p>
                  <p className="mt-0.5 text-[11px] font-normal text-neutral-400">{row.subtitle}</p>
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums text-neutral-600">{formatNumber(row.orders)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-neutral-600">{formatNumber(row.units)}</td>
                {groupBy === 'product' ? (
                  <td className="px-4 py-3.5 text-right tabular-nums text-neutral-600">{formatCurrency(row.averageSoldPrice)}</td>
                ) : null}
                <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-neutral-900">{formatCurrency(row.revenue)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-emerald-700">{formatCurrency(row.savings)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500">{row.savingsUntrackedUnits ? `${formatNumber(row.savingsUntrackedUnits)} un.` : '—'}</td>
                <td className="px-5 py-3.5 text-right font-medium tabular-nums text-[#bc7f2c]">{(row.share * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {!(detailView ? soldLines.length : summary.rows.length) ? (
          <div className="px-5 py-10 text-center text-[13px] text-neutral-500">No se registraron ventas promocionales con estos filtros.</div>
        ) : null}
      </div>

      <p className="border-t border-neutral-100 px-5 py-3 text-[11px] leading-5 text-neutral-500">
        Se excluyen pedidos cancelados y envíos. Cada importe se suma desde el total histórico de la línea de pedido; no se consulta el precio actual del producto.
        El ahorro solo se suma cuando el precio original quedó registrado en esa venta.
        {summary.savingsUntrackedUnits > 0
          ? ` ${formatNumber(summary.savingsUntrackedUnits)} unidades promocionales no tienen precio original histórico guardado, por lo que no se estima su ahorro.`
          : ''}
      </p>
      <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={detailView ? soldLines.length : summary.rows.length} onPageChange={setPage} />
    </>
  );
}
