'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  BarChart3,
  ArrowUpRight,
  CircleDollarSign,
  Download,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Table2,
  Truck,
  WalletCards,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AnimatedValue } from '@/shared/components/ui/AnimatedValue';
import { Button } from '@/shared/components/ui/Button';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ReportCharts } from '../components/ReportCharts';
import { ReportExportDialog, type ReportExportMode } from '../components/ReportExportDialog';
import { ReportFilters } from '../components/ReportFilters';
import { ReportTables } from '../components/ReportTables';
import { useReportes } from '../hooks/useReportes';
import { getCompleteReportData, getReportOrdersPage } from '../services/reportes.service';
import type {
  ReportDatePreset,
  ReportFilters as ReportFilterState,
  ReportGroupBy,
  ReportOrder,
} from '../types/reporte.types';
import {
  formatCurrency,
  formatDateInput,
  formatNumber,
  formatOrderSource,
  formatReportDate,
  getPresetRange,
  getReportSummary,
  groupReport,
} from '../utils/reportes.utils';
import { exportRawDataToExcel, exportReportToExcel } from '../utils/xlsx-export.utils';

function createDefaultFilters(): ReportFilterState {
  return {
    ...getPresetRange('thisMonth'),
    allTime: false,
    status: 'valid',
    paymentMethod: 'all',
    deliveryMethod: 'all',
    source: 'all',
    search: '',
  };
}

function FinancialOverview({
  grossRevenue,
  netRevenue,
  deliveryRevenue,
  settledDeliveryCommission,
  periodLabel,
}: {
  grossRevenue: number;
  netRevenue: number;
  deliveryRevenue: number;
  settledDeliveryCommission: number;
  periodLabel: string;
}) {
  const productRevenue = grossRevenue - deliveryRevenue;

  return (
    <section aria-label="Balance de facturación" className="relative flex min-w-0 flex-col overflow-hidden rounded-[24px] bg-[#191b20] p-5 text-white shadow-soft sm:p-7 lg:min-h-[340px]">
      <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-central-orange/10 blur-[60px]" aria-hidden="true" />
      <div className="relative flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-white/45">Balance comercial</p>
          <p className="mt-1 max-w-lg truncate text-xs text-white/55" title={periodLabel}>{periodLabel}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[.08] text-white/85">
          <CircleDollarSign size={20} strokeWidth={1.7} />
        </div>
      </div>

      <div className="relative mt-8 min-w-0">
        <p className="text-[13px] font-medium text-white/65">Facturación bruta acumulada</p>
        <p className="mt-2 break-words text-[clamp(2.45rem,5vw,4.15rem)] font-semibold leading-none tracking-[-.06em] [font-variant-numeric:tabular-nums]">
          <AnimatedValue value={grossRevenue} formatter={formatCurrency} duration={950} />
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/50">
          <ArrowUpRight size={13} className="text-central-orange" />
          Ventas válidas del período seleccionado
        </p>
      </div>

      <div className="relative mt-8 grid min-w-0 grid-cols-1 gap-5 border-t border-white/10 pt-5 sm:grid-cols-2 lg:mt-auto lg:pt-6">
        <div className="min-w-0">
          <p className="text-[11px] text-white/50">Neto tras comisiones de delivery</p>
          <p className="mt-1.5 break-words text-[clamp(1.55rem,2.5vw,2.1rem)] font-semibold leading-tight tracking-[-.045em] text-[#c7f0d7] [font-variant-numeric:tabular-nums]">
            <AnimatedValue value={netRevenue} formatter={formatCurrency} duration={950} />
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:py-1 sm:pl-5">
          <div className="min-w-0">
            <p className="text-[11px] text-white/50">Productos</p>
            <p className="mt-1 break-words text-[15px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">{formatCurrency(productRevenue)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-white/50">Envíos</p>
            <p className="mt-1 break-words text-[15px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">{formatCurrency(deliveryRevenue)}</p>
          </div>
        </div>
      </div>
      <p className="relative mt-3 text-[10px] text-white/35">
        Neto = facturación bruta menos comisiones de delivery liquidadas ({formatCurrency(settledDeliveryCommission)}).
      </p>
    </section>
  );
}

function MetricCard({ label, value, detail, icon: Icon, formatter }: {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  formatter: (value: number) => string;
}) {
  return (
    <article className="min-w-0 border-b border-neutral-100 px-4 py-4 last:border-b-0 sm:px-5 lg:border-b-0 lg:border-r lg:border-neutral-100 lg:last:border-r-0">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[#f6f6f7] text-neutral-500"><Icon size={14} /></span>
        <p className="min-w-0 text-[11px] font-medium leading-4 text-neutral-500">{label}</p>
      </div>
      <p className="mt-3 break-words text-[clamp(1.25rem,1.8vw,1.7rem)] font-semibold leading-tight tracking-[-.045em] text-neutral-900 [font-variant-numeric:tabular-nums]">
        <AnimatedValue value={value} formatter={formatter} />
      </p>
      <p className="mt-1 text-[11px] leading-4 text-neutral-400">{detail}</p>
    </article>
  );
}

function getEarliestOrderDate(orders: { createdAt: string }[]) {
  if (!orders.length) return null;
  return orders.reduce((current, order) => {
    const candidate = new Date(order.createdAt);
    return candidate < current ? candidate : current;
  }, new Date(orders[0].createdAt));
}

export function ReportesAdminPage() {
  const initial = useMemo(() => createDefaultFilters(), []);
  const [preset, setPreset] = useState<ReportDatePreset>('thisMonth');
  const [draftFilters, setDraftFilters] = useState<ReportFilterState>(initial);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterState>(initial);
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('day');
  const [analysisView, setAnalysisView] = useState<'tables' | 'charts'>('charts');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingMode, setExportingMode] = useState<ReportExportMode | null>(null);
  const [detailOrders, setDetailOrders] = useState<ReportOrder[]>([]);
  const [detailPage, setDetailPage] = useState(1);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailRevision, setDetailRevision] = useState(0);
  const { config } = useBusinessConfig();
  const { data, isLoading, error, lastLoadedAt, refresh } = useReportes(appliedFilters);
  const filteredData = useMemo(() => {
    const source = appliedFilters.source ?? 'all';
    if (source === 'all') return data;
    const orders = data.orders.filter((order) => order.source === source);
    const orderIds = new Set(orders.map((order) => order.id));
    return {
      orders,
      items: data.items.filter((item) => orderIds.has(item.orderId)),
      settledDeliveryCommissions: data.settledDeliveryCommissions.filter((commission) => orderIds.has(commission.orderId)),
    };
  }, [data, appliedFilters.source]);
  const summary = useMemo(() => getReportSummary(filteredData), [filteredData]);
  const groups = useMemo(() => groupReport(filteredData, groupBy), [filteredData, groupBy]);
  const earliestOrderDate = useMemo(() => getEarliestOrderDate(filteredData.orders), [filteredData.orders]);

  useEffect(() => {
    let active = true;
    setDetailLoading(true);

    getReportOrdersPage(appliedFilters, detailPage, 10)
      .then((result) => {
        if (!active) return;
        setDetailOrders(result.orders);
        setDetailTotal(result.total);

        const maxPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (detailPage > maxPage) setDetailPage(maxPage);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setDetailOrders([]);
        setDetailTotal(0);
        toast.error(caught instanceof Error ? caught.message : 'No se pudo cargar el detalle paginado del reporte.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, detailPage, detailRevision]);

  function handlePresetChange(nextPreset: ReportDatePreset) {
    setPreset(nextPreset);
    if (nextPreset === 'allTime') { setDraftFilters((current) => ({ ...current, allTime: true })); return; }
    if (nextPreset !== 'custom') { setDraftFilters((current) => ({ ...current, ...getPresetRange(nextPreset), allTime: false })); return; }
    setDraftFilters((current) => ({ ...current, allTime: false }));
  }

  function handleDraftChange(next: ReportFilterState) {
    if (next.from !== draftFilters.from || next.to !== draftFilters.to || (draftFilters.allTime && !next.allTime)) setPreset('custom');
    setDraftFilters(next);
  }

  function applyFilters() {
    if (!draftFilters.allTime && (!draftFilters.from || !draftFilters.to)) return void toast.warning('Seleccioná las fechas del reporte.');
    if (!draftFilters.allTime && draftFilters.from > draftFilters.to) return void toast.warning('La fecha desde no puede ser posterior a la fecha hasta.');
    setDetailPage(1);
    setAppliedFilters({ ...draftFilters });
  }

  function resetFilters() {
    const next = createDefaultFilters();
    setPreset('thisMonth');
    setDraftFilters(next);
    setAppliedFilters(next);
    setGroupBy('day');
    setDetailPage(1);
  }

  function refreshAll() {
    refresh();
    setDetailRevision((value) => value + 1);
  }

  async function handleExport(mode: ReportExportMode) {
    if (mode === 'analytical' && !filteredData.orders.length) return void toast.info('No hay datos para exportar con los filtros seleccionados.');
    setExportingMode(mode);
    try {
      if (mode === 'raw') {
        const completeData = await getCompleteReportData();
        if (!completeData.orders.length) return void toast.info('Todavía no hay información histórica para exportar.');
        exportRawDataToExcel({
          dataset: { ...completeData, orders: completeData.orders.map((order) => ({ ...order, source: formatOrderSource(order.source) })) },
          businessName: config?.businessName ?? 'La Central Burger',
        });
        toast.success('Base cruda completa generada correctamente.');
        setExportDialogOpen(false);
        return;
      }
      const exportFilters = appliedFilters.allTime && earliestOrderDate ? { ...appliedFilters, from: formatDateInput(earliestOrderDate), to: formatDateInput(new Date()) } : appliedFilters;
      exportReportToExcel({ dataset: filteredData, filters: exportFilters, groupBy, businessName: config?.businessName ?? 'La Central Burger' });
      toast.success('Reporte Excel generado correctamente.');
      setExportDialogOpen(false);
    } catch (caught: unknown) {
      toast.error(caught instanceof Error ? caught.message : 'No se pudo exportar el reporte.');
    } finally {
      setExportingMode(null);
    }
  }

  const periodDescription = appliedFilters.allTime
    ? earliestOrderDate ? `Histórico completo · desde el ${formatReportDate(earliestOrderDate)} hasta hoy` : 'Histórico completo · sin pedidos registrados'
    : `Período aplicado: ${formatReportDate(`${appliedFilters.from}T12:00:00`)} al ${formatReportDate(`${appliedFilters.to}T12:00:00`)}`;

  const hasPendingChanges = JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);

  return (
    <div className="min-w-0 pb-8">
      <div className="mb-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Finanzas y movimientos</h1>
          <p className="mt-1 text-[13px] leading-5 text-neutral-500">Toda la actividad comercial, en un solo lugar.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={refreshAll}
            disabled={isLoading || detailLoading}
            className="!h-9 !rounded-[11px] !border-neutral-200 !px-3 !text-[12px] !font-semibold !shadow-none"
            title="Actualizar información"
          >
            <RefreshCw size={14} className={isLoading || detailLoading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            disabled={isLoading || exportingMode !== null}
            className="!h-9 !rounded-[11px] !bg-[#188650] !px-3.5 !text-[12px] !font-semibold !text-white !shadow-[0_3px_10px_rgba(24,134,80,.14)] transition-[background-color,box-shadow,transform] duration-200 hover:!bg-[#136d41] hover:!shadow-[0_4px_13px_rgba(24,134,80,.18)] focus:!ring-[#188650]/30 active:scale-[.98]"
          >
            <Download size={14} />
            {exportingMode ? 'Generando…' : 'Exportar Excel'}
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      ) : null}

      <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(290px,1fr)]">
        <FinancialOverview
          grossRevenue={summary.grossRevenue}
          netRevenue={summary.netRevenue}
          deliveryRevenue={summary.deliveryRevenue}
          settledDeliveryCommission={summary.settledDeliveryCommission}
          periodLabel={periodDescription}
        />
        <ReportFilters
          filters={draftFilters}
          preset={preset}
          isLoading={isLoading}
          hasPendingChanges={hasPendingChanges}
          onPresetChange={handlePresetChange}
          onChange={handleDraftChange}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[11px] text-neutral-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
        {lastLoadedAt
          ? `Datos actualizados a las ${lastLoadedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
          : 'Preparando información…'}
      </div>

      <section aria-label="Indicadores del período" className="mt-5 grid min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-soft sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Pedidos válidos" value={summary.validOrders} detail={`${formatNumber(summary.totalOrders)} seleccionados`} icon={ShoppingBag} formatter={formatNumber} />
        <MetricCard label="Ticket promedio" value={summary.averageTicket} detail="Por pedido válido" icon={ReceiptText} formatter={formatCurrency} />
        <MetricCard label="Unidades vendidas" value={summary.unitsSold} detail="Productos vendidos" icon={PackageCheck} formatter={formatNumber} />
        <MetricCard label="Delivery cobrado" value={summary.deliveryRevenue} detail="Incluido en facturación" icon={Truck} formatter={formatCurrency} />
        <MetricCard label="Comisiones liquidadas" value={summary.settledDeliveryCommission} detail="Marcadas como pagadas" icon={WalletCards} formatter={formatCurrency} />
        <MetricCard label="Cancelaciones" value={summary.cancelledOrders} detail={`${(summary.cancellationRate * 100).toFixed(1)}% de los pedidos`} icon={Ban} formatter={formatNumber} />
      </section>

      <section className="mb-5 mt-9 flex min-w-0 flex-col justify-between gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="text-[21px] font-semibold tracking-[-.035em] text-neutral-950">Análisis de actividad</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Consultá las tendencias o explorá cada movimiento.</p>
        </div>
        <div role="group" aria-label="Modo de visualización" className="inline-grid w-full shrink-0 grid-cols-2 rounded-[12px] bg-[#eaeaec] p-1 sm:w-auto">
          <button
            type="button"
            aria-pressed={analysisView === 'charts'}
            onClick={() => setAnalysisView('charts')}
            className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] px-4 text-[12px] font-semibold transition-all duration-200 ${analysisView === 'charts' ? 'bg-white text-neutral-900 shadow-[0_1px_4px_rgba(0,0,0,.10)]' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            <BarChart3 size={15} />
            Gráficos
          </button>
          <button
            type="button"
            aria-pressed={analysisView === 'tables'}
            onClick={() => setAnalysisView('tables')}
            className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] px-4 text-[12px] font-semibold transition-all duration-200 ${analysisView === 'tables' ? 'bg-white text-neutral-900 shadow-[0_1px_4px_rgba(0,0,0,.10)]' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            <Table2 size={15} />
            Tablas
          </button>
        </div>
      </section>

      {analysisView === 'tables' ? (
        isLoading
          ? <div className="rounded-[18px] border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500 shadow-soft">Preparando movimientos…</div>
          : <ReportTables groups={groups} groupBy={groupBy} onGroupByChange={setGroupBy} detailOrders={detailOrders} detailTotal={detailTotal} detailPage={detailPage} detailLoading={detailLoading} onDetailPageChange={setDetailPage} />
      ) : (
        <ReportCharts dataset={filteredData} filters={appliedFilters} periodLabel={periodDescription} isLoading={isLoading} />
      )}

      <ReportExportDialog
        open={exportDialogOpen}
        hasFilteredData={Boolean(filteredData.orders.length)}
        exportingMode={exportingMode}
        onClose={() => { if (!exportingMode) setExportDialogOpen(false); }}
        onExport={(mode) => void handleExport(mode)}
      />
    </div>
  );
}
