'use client';

import { useEffect, useRef, useState } from 'react';
import { Layers3, List } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import { Select } from '@/shared/components/ui/Select';
import type { ReportDataset, ReportGroupBy, ReportGroupRow } from '../types/reporte.types';
import {
  formatCurrency,
  formatNumber,
  formatReportDateTime,
  REPORT_GROUP_LABELS,
} from '../utils/reportes.utils';

interface ReportTablesProps {
  dataset: ReportDataset;
  groups: ReportGroupRow[];
  groupBy: ReportGroupBy;
  onGroupByChange: (groupBy: ReportGroupBy) => void;
}

const VIEW_TRANSITION_MS = 220;

function ReportTableSkeleton({ view }: { view: 'consolidated' | 'detail' }) {
  const columnCount = view === 'consolidated' ? 7 : 9;
  const minWidth = view === 'consolidated' ? 'min-w-[940px]' : 'min-w-[1120px]';

  return (
    <div role="status" aria-live="polite" className={minWidth}>
      <span className="sr-only">Actualizando información del reporte…</span>
      <div
        className="grid gap-6 border-b border-neutral-100 bg-neutral-50 px-5 py-3"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columnCount }, (_, index) => (
          <Skeleton key={`header-${index}`} height={10} width={index === 0 ? '72%' : '58%'} duration={0.65} />
        ))}
      </div>
      <div className="divide-y divide-neutral-100 px-5">
        {Array.from({ length: 7 }, (_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid items-center gap-6 py-3.5"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columnCount }, (_, columnIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${columnIndex}`}
                height={12}
                width={columnIndex === 0 ? '82%' : `${54 + ((rowIndex + columnIndex) % 4) * 9}%`}
                duration={0.65}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportTables({ dataset, groups, groupBy, onGroupByChange }: ReportTablesProps) {
  const [view, setView] = useState<'consolidated' | 'detail'>('consolidated');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupOptions = (Object.entries(REPORT_GROUP_LABELS) as [ReportGroupBy, string][]).map(([value, label]) => ({
    value,
    label: `Agrupar por ${label.toLocaleLowerCase('es-AR')}`,
  }));

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);

  function beginContentTransition(update: () => void) {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setIsTransitioning(true);
    update();
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
      transitionTimerRef.current = null;
    }, VIEW_TRANSITION_MS);
  }

  function handleViewChange(nextView: 'consolidated' | 'detail') {
    if (nextView === view) return;
    beginContentTransition(() => setView(nextView));
  }

  function handleGroupChange(nextGroup: ReportGroupBy) {
    if (nextGroup === groupBy) return;
    beginContentTransition(() => onGroupByChange(nextGroup));
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 border-b border-neutral-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-base font-extrabold text-central-carbon">Detalle y consolidación</h3>
          <p className="mt-1 break-words text-xs leading-5 text-neutral-500">Alterná entre una vista agrupada y el detalle transaccional de pedidos.</p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-[12rem_auto] sm:items-center">
          <div className={view === 'consolidated' ? 'order-2 min-h-10 sm:order-1' : 'hidden sm:order-1 sm:block sm:min-h-10'}>
            {view === 'consolidated' ? (
              <Select
                aria-label="Agrupar reporte"
                variant="light"
                value={groupBy}
                options={groupOptions}
                onValueChange={(nextGroup) => handleGroupChange(nextGroup as ReportGroupBy)}
                className="min-w-0 text-xs font-bold"
              />
            ) : (
              <div aria-hidden="true" className="hidden h-10 sm:block" />
            )}
          </div>

          <div className="grid min-w-0 grid-cols-2 rounded-sm border border-neutral-200 bg-neutral-50 p-1 sm:flex">
            <button
              type="button"
              aria-pressed={view === 'consolidated'}
              onClick={() => handleViewChange('consolidated')}
              className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs font-bold ${view === 'consolidated' ? 'bg-white text-central-orange shadow-sm' : 'text-neutral-500'}`}
            >
              <Layers3 size={14} className="shrink-0" /> <span className="truncate">Consolidado</span>
            </button>
            <button
              type="button"
              aria-pressed={view === 'detail'}
              onClick={() => handleViewChange('detail')}
              className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs font-bold ${view === 'detail' ? 'bg-white text-central-orange shadow-sm' : 'text-neutral-500'}`}
            >
              <List size={14} className="shrink-0" /> <span className="truncate">Detalle</span>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-[30rem] max-w-full overflow-x-auto overscroll-x-contain sm:min-h-[34rem] xl:min-h-[38rem]">
        {isTransitioning ? (
          <ReportTableSkeleton view={view} />
        ) : (
          <div className="report-table-enter">
            {view === 'consolidated' ? (
              <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-neutral-50 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-5 py-3">{REPORT_GROUP_LABELS[groupBy]}</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-right">Cancelados</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">Facturación</th>
                <th className="px-4 py-3 text-right">Ticket medio</th>
                <th className="px-5 py-3 text-right">Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {groups.map((row) => (
                <tr key={row.key} className="transition hover:bg-neutral-50/70">
                  <td className="px-5 py-3.5 font-bold text-central-carbon">{row.label}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-600">{formatNumber(row.orders)}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-600">{formatNumber(row.cancelledOrders)}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-600">{formatNumber(row.units)}</td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-central-carbon">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-600">{formatCurrency(row.averageTicket)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-central-orange">{(row.share * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-neutral-50 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Entrega</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Delivery</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {dataset.orders.map((order) => (
                <tr key={order.id} className="transition hover:bg-neutral-50/70">
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{formatReportDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3.5 font-extrabold text-central-orange">{order.orderCode}</td>
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-central-carbon">{order.customerName}</p>
                    <p className="text-xs text-neutral-500">{order.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3.5 text-neutral-600">{order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro local'}</td>
                  <td className="px-4 py-3.5 text-neutral-600">{order.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}</td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-sm px-2 py-1 text-xs font-bold ${order.status === 'cancelado' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-neutral-600">{formatCurrency(order.subtotal)}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-600">{formatCurrency(order.deliveryCost)}</td>
                  <td className="px-5 py-3.5 text-right font-extrabold text-central-carbon">{formatCurrency(order.total)}</td>
                </tr>
              ))}
            </tbody>
              </table>
            )}

            {!dataset.orders.length ? (
              <div className="border-t border-neutral-100 px-5 py-10 text-center text-sm text-neutral-500">No hay datos para el período y filtros seleccionados.</div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
