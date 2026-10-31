'use client';

import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/shared/components/ui/Select';
import { TablePagination } from '@/shared/components/ui/TablePagination';
import type { ReportDataset } from '../types/reporte.types';
import { formatCurrency, formatNumber } from '../utils/reportes.utils';
import { summarizePromotionSales, type PromotionGroupMode } from '../utils/report-promotions.utils';

const PAGE_SIZE = 10;

export function PromotionReport({ dataset }: { dataset: ReportDataset }) {
  const [groupBy, setGroupBy] = useState<PromotionGroupMode>('campaign');
  const [page, setPage] = useState(1);
  const summary = useMemo(() => summarizePromotionSales(dataset, groupBy), [dataset, groupBy]);
  useEffect(() => setPage(1), [dataset, groupBy]);
  const visibleRows = summary.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <p className="text-[13px] font-semibold text-neutral-900">Ventas de productos en promoción</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">Mismo período y filtros aplicados al resto del informe.</p>
        </div>
        <div className="w-full sm:w-48">
          <Select aria-label="Agrupar ofertas" variant="light" value={groupBy}
            options={[{value:'campaign',label:'Por campaña'}, {value:'product',label:'Por producto'}]}
            onValueChange={(value) => setGroupBy(value as PromotionGroupMode)}
            className="!h-9 !rounded-[10px] !border-neutral-200 !bg-[#f8f8f9] !text-[12px] !font-medium !shadow-none" />
        </div>
      </div>

      <div className="grid gap-4 border-b border-neutral-100 px-5 py-5 sm:grid-cols-2 xl:grid-cols-5">
        {([
          ['Facturación en oferta', formatCurrency(summary.revenue)],
          ['Unidades promocionales', formatNumber(summary.units)],
          ['Pedidos con ofertas', formatNumber(summary.orders)],
          ['Ahorro registrado', formatCurrency(summary.savings)],
          ['% de ventas de productos', `${(summary.share * 100).toFixed(1)}%`],
        ] as const).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-[11px] text-neutral-500">{label}</p>
            <p className="mt-1 text-[clamp(1.15rem,2vw,1.55rem)] font-semibold tracking-tight tabular-nums text-neutral-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-left text-sm">
          <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-3">{groupBy === 'campaign' ? 'Campaña / promoción' : 'Producto'}</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Facturado</th>
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
                <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-neutral-900">{formatCurrency(row.revenue)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-emerald-700">{formatCurrency(row.savings)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500">{row.savingsUntrackedUnits ? `${formatNumber(row.savingsUntrackedUnits)} un.` : '—'}</td>
                <td className="px-5 py-3.5 text-right font-medium tabular-nums text-[#bc7f2c]">{(row.share * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!summary.rows.length ? (
          <div className="px-5 py-10 text-center text-[13px] text-neutral-500">No se registraron ventas promocionales con estos filtros.</div>
        ) : null}
      </div>

      <p className="border-t border-neutral-100 px-5 py-3 text-[11px] leading-5 text-neutral-500">
        Se excluyen pedidos cancelados y envíos. Los importes muestran lo efectivamente cobrado por productos.
        El ahorro solo se suma cuando se registró el precio original en la venta.
        {summary.savingsUntrackedUnits > 0
          ? ` ${formatNumber(summary.savingsUntrackedUnits)} unidades promocionales históricas o manuales no tienen ahorro verificable.`
          : ''}
      </p>
      <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={summary.rows.length} onPageChange={setPage} />
    </>
  );
}
