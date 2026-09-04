'use client';

import { useMemo, useState } from 'react';
import {
  Ban,
  DollarSign,
  Download,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Button } from '@/shared/components/ui/Button';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ReportFilters } from '../components/ReportFilters';
import { ReportCharts } from '../components/ReportCharts';
import { ReportTables } from '../components/ReportTables';
import { useReportes } from '../hooks/useReportes';
import type {
  ReportDatePreset,
  ReportFilters as ReportFilterState,
  ReportGroupBy,
} from '../types/reporte.types';
import {
  formatCurrency,
  formatDateInput,
  formatNumber,
  formatReportDate,
  getPresetRange,
  getReportSummary,
  groupReport,
} from '../utils/reportes.utils';
import { exportReportToExcel } from '../utils/xlsx-export.utils';

function createDefaultFilters(): ReportFilterState {
  return {
    ...getPresetRange('thisMonth'),
    allTime: false,
    status: 'valid',
    paymentMethod: 'all',
    deliveryMethod: 'all',
    search: '',
  };
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
      <span className="absolute right-4 top-4 grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange">
        <Icon size={18} />
      </span>
      <div className="min-w-0 pr-12">
        <p className="truncate text-xs font-bold text-neutral-500">{label}</p>
        <p className="mt-2 break-words text-2xl font-extrabold tracking-tight text-central-carbon">{value}</p>
        <p className="mt-1 max-w-full text-xs leading-5 text-neutral-500">{detail}</p>
      </div>
    </article>
  );
}

function getEarliestOrderDate(orders: { createdAt: string }[]) {
  if (!orders.length) return null;
  const earliest = orders.reduce((current, order) => {
    const candidate = new Date(order.createdAt);
    return candidate < current ? candidate : current;
  }, new Date(orders[0].createdAt));
  return earliest;
}

export function ReportesAdminPage() {
  const initial = useMemo(() => createDefaultFilters(), []);
  const [preset, setPreset] = useState<ReportDatePreset>('thisMonth');
  const [draftFilters, setDraftFilters] = useState<ReportFilterState>(initial);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterState>(initial);
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('day');
  const [isExporting, setIsExporting] = useState(false);
  const { config } = useBusinessConfig();
  const { data, isLoading, error, lastLoadedAt, refresh } = useReportes(appliedFilters);
  const summary = useMemo(() => getReportSummary(data), [data]);
  const groups = useMemo(() => groupReport(data, groupBy), [data, groupBy]);
  const earliestOrderDate = useMemo(() => getEarliestOrderDate(data.orders), [data.orders]);

  function handlePresetChange(nextPreset: ReportDatePreset) {
    setPreset(nextPreset);

    if (nextPreset === 'allTime') {
      setDraftFilters((current) => ({ ...current, allTime: true }));
      return;
    }

    if (nextPreset !== 'custom') {
      setDraftFilters((current) => ({
        ...current,
        ...getPresetRange(nextPreset),
        allTime: false,
      }));
      return;
    }

    setDraftFilters((current) => ({ ...current, allTime: false }));
  }

  function handleDraftChange(next: ReportFilterState) {
    if (next.from !== draftFilters.from || next.to !== draftFilters.to) {
      setPreset('custom');
    }
    setDraftFilters(next);
  }

  function applyFilters() {
    if (!draftFilters.allTime && (!draftFilters.from || !draftFilters.to)) {
      toast.warning('Seleccioná las fechas del reporte.');
      return;
    }
    if (!draftFilters.allTime && draftFilters.from > draftFilters.to) {
      toast.warning('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }
    setAppliedFilters({ ...draftFilters });
  }

  function resetFilters() {
    const next = createDefaultFilters();
    setPreset('thisMonth');
    setDraftFilters(next);
    setAppliedFilters(next);
    setGroupBy('day');
  }

  function handleExport() {
    if (!data.orders.length) {
      toast.info('No hay datos para exportar con los filtros seleccionados.');
      return;
    }

    setIsExporting(true);
    try {
      const exportFilters = appliedFilters.allTime && earliestOrderDate
        ? {
            ...appliedFilters,
            from: formatDateInput(earliestOrderDate),
            to: formatDateInput(new Date()),
          }
        : appliedFilters;

      exportReportToExcel({
        dataset: data,
        filters: exportFilters,
        groupBy,
        businessName: config?.businessName ?? 'La Central Burger',
      });
      toast.success('Reporte Excel generado correctamente.');
    } catch (caught: unknown) {
      toast.error(caught instanceof Error ? caught.message : 'No se pudo exportar el reporte.');
    } finally {
      setIsExporting(false);
    }
  }

  const periodDescription = appliedFilters.allTime
    ? earliestOrderDate
      ? `Histórico completo · desde el ${formatReportDate(earliestOrderDate)} hasta hoy`
      : 'Histórico completo · sin pedidos registrados'
    : `Período aplicado: ${formatReportDate(`${appliedFilters.from}T12:00:00`)} al ${formatReportDate(`${appliedFilters.to}T12:00:00`)}`;

  return (
    <div className="min-w-0">
      <AdminPageHeader
        eyebrow="Reportes"
        title="Centro de análisis comercial"
        description="Consolidá ventas por períodos, productos, categorías, medios de pago y entregas. Todos los indicadores se calculan sobre los datos reales registrados en Supabase."
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={refresh} disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Actualizar
            </Button>
            <Button type="button" onClick={handleExport} disabled={isLoading || isExporting || !data.orders.length}>
              <Download size={16} /> {isExporting ? 'Generando…' : 'Exportar Excel'}
            </Button>
          </>
        )}
      />

      <ReportFilters
        filters={draftFilters}
        preset={preset}
        isLoading={isLoading}
        onPresetChange={handlePresetChange}
        onChange={handleDraftChange}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {error ? (
        <div className="mb-6 rounded-sm border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
      ) : null}

      <div className="mb-4 flex min-w-0 flex-col gap-1 text-xs leading-5 text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-words">
          {periodDescription}
        </p>
        <p className="shrink-0">{lastLoadedAt ? `Actualizado ${lastLoadedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Preparando información…'}</p>
      </div>

      <section className="mb-6 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Facturación neta" value={formatCurrency(summary.netRevenue)} detail="Pedidos no cancelados" icon={DollarSign} />
        <MetricCard label="Pedidos válidos" value={formatNumber(summary.validOrders)} detail={`${formatNumber(summary.totalOrders)} pedidos seleccionados`} icon={ShoppingBag} />
        <MetricCard label="Ticket promedio" value={formatCurrency(summary.averageTicket)} detail="Promedio por pedido válido" icon={ReceiptText} />
        <MetricCard label="Unidades vendidas" value={formatNumber(summary.unitsSold)} detail="Productos de ventas válidas" icon={PackageCheck} />
        <MetricCard label="Delivery cobrado" value={formatCurrency(summary.deliveryRevenue)} detail="Importe facturado por envíos" icon={Truck} />
        <MetricCard label="Cancelaciones" value={formatNumber(summary.cancelledOrders)} detail={`${(summary.cancellationRate * 100).toFixed(1)}% del total seleccionado`} icon={Ban} />
      </section>

      {isLoading ? (
        <div className="mb-6 rounded-sm border border-neutral-200 bg-white p-12 text-center text-sm font-semibold text-neutral-500 shadow-sm">Procesando el reporte…</div>
      ) : (
        <>
          <ReportCharts dataset={data} />
          <ReportTables dataset={data} groups={groups} groupBy={groupBy} onGroupByChange={setGroupBy} />
        </>
      )}
    </div>
  );
}
