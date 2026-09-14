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
  WalletCards,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { AnimatedValue } from '@/shared/components/ui/AnimatedValue';
import { Button } from '@/shared/components/ui/Button';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ReportExportDialog, type ReportExportMode } from '../components/ReportExportDialog';
import { ReportFilters } from '../components/ReportFilters';
import { ReportTables } from '../components/ReportTables';
import { useReportes } from '../hooks/useReportes';
import { getCompleteReportData } from '../services/reportes.service';
import type {
  ReportDatePreset,
  ReportFilters as ReportFilterState,
  ReportGroupBy,
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

function FeaturedMetricCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: 'gross' | 'net' }) {
  const isNet = tone === 'net';
  return (
    <article className={`relative min-h-[178px] overflow-hidden rounded-sm border p-6 shadow-sm sm:col-span-2 xl:col-span-3 2xl:col-span-6 ${isNet ? 'border-emerald-200 bg-[#eef8f3]' : 'border-central-carbon bg-central-carbon text-white'}`}>
      <div className="relative z-10 flex h-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isNet ? 'text-emerald-700' : 'text-white/55'}`}>{label}</p>
            <p className={`mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-[42px] ${isNet ? 'text-[#0f8a5f]' : 'text-white'}`}><AnimatedValue value={value} formatter={formatCurrency} duration={900} /></p>
          </div>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-sm ${isNet ? 'bg-white text-[#0f8a5f] shadow-sm' : 'bg-white/10 text-central-orange'}`}><DollarSign size={20} /></span>
        </div>
        <p className={`max-w-2xl text-sm leading-6 ${isNet ? 'text-emerald-900/70' : 'text-white/60'}`}>{detail}</p>
      </div>
    </article>
  );
}

function MetricCard({ label, value, detail, icon: Icon, formatter }: { label: string; value: number; detail: string; icon: React.ComponentType<{ size?: number; className?: string }>; formatter: (value: number) => string }) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-sm border border-neutral-200 bg-white p-5 shadow-sm xl:col-span-2 2xl:col-span-2">
      <span className="absolute right-4 top-4 grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><Icon size={18} /></span>
      <div className="min-w-0 pr-12">
        <p className="truncate text-xs font-bold text-neutral-500">{label}</p>
        <p className="mt-2 break-words text-2xl font-extrabold tracking-tight text-central-carbon"><AnimatedValue value={value} formatter={formatter} /></p>
        <p className="mt-1 max-w-full text-xs leading-5 text-neutral-500">{detail}</p>
      </div>
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingMode, setExportingMode] = useState<ReportExportMode | null>(null);
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

  function handlePresetChange(nextPreset: ReportDatePreset) {
    setPreset(nextPreset);
    if (nextPreset === 'allTime') { setDraftFilters((current) => ({ ...current, allTime: true })); return; }
    if (nextPreset !== 'custom') { setDraftFilters((current) => ({ ...current, ...getPresetRange(nextPreset), allTime: false })); return; }
    setDraftFilters((current) => ({ ...current, allTime: false }));
  }

  function handleDraftChange(next: ReportFilterState) {
    if (next.from !== draftFilters.from || next.to !== draftFilters.to) setPreset('custom');
    setDraftFilters(next);
  }

  function applyFilters() {
    if (!draftFilters.allTime && (!draftFilters.from || !draftFilters.to)) return void toast.warning('Seleccioná las fechas del reporte.');
    if (!draftFilters.allTime && draftFilters.from > draftFilters.to) return void toast.warning('La fecha desde no puede ser posterior a la fecha hasta.');
    setAppliedFilters({ ...draftFilters });
  }

  function resetFilters() {
    const next = createDefaultFilters();
    setPreset('thisMonth');
    setDraftFilters(next);
    setAppliedFilters(next);
    setGroupBy('day');
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

  return (
    <div className="min-w-0">
      <AdminPageHeader eyebrow="Reportes" title="Centro de análisis comercial" description="Filtrá, consolidá y exportá la información comercial por períodos, productos, categorías, medios de pago, entregas y origen de venta." actions={<><Button type="button" variant="secondary" onClick={refresh} disabled={isLoading}><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Actualizar</Button><Button type="button" onClick={() => setExportDialogOpen(true)} disabled={isLoading || exportingMode !== null}><Download size={16} /> {exportingMode ? 'Generando…' : 'Exportar Excel'}</Button></>} />
      <ReportFilters filters={draftFilters} preset={preset} isLoading={isLoading} onPresetChange={handlePresetChange} onChange={handleDraftChange} onApply={applyFilters} onReset={resetFilters} />
      {error ? <div className="mb-6 rounded-sm border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="mb-4 flex min-w-0 flex-col gap-1 text-xs leading-5 text-neutral-500 sm:flex-row sm:items-center sm:justify-between"><p className="min-w-0 break-words">{periodDescription}</p><p className="shrink-0">{lastLoadedAt ? `Actualizado ${lastLoadedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Preparando información…'}</p></div>
      <section className="mb-6 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-12">
        <FeaturedMetricCard label="Ganancia bruta" value={summary.grossRevenue} detail={`Ventas válidas: productos ${formatCurrency(summary.grossRevenue - summary.deliveryRevenue)} + delivery ${formatCurrency(summary.deliveryRevenue)}.`} tone="gross" />
        <FeaturedMetricCard label="Ganancia neta" value={summary.netRevenue} detail={`Ganancia bruta ${formatCurrency(summary.grossRevenue)} − comisiones de delivery liquidadas ${formatCurrency(summary.settledDeliveryCommission)}.`} tone="net" />
        <MetricCard label="Pedidos válidos" value={summary.validOrders} detail={`${formatNumber(summary.totalOrders)} pedidos seleccionados`} icon={ShoppingBag} formatter={formatNumber} />
        <MetricCard label="Ticket promedio" value={summary.averageTicket} detail="Promedio por pedido válido" icon={ReceiptText} formatter={formatCurrency} />
        <MetricCard label="Unidades vendidas" value={summary.unitsSold} detail="Productos de ventas válidas" icon={PackageCheck} formatter={formatNumber} />
        <MetricCard label="Delivery cobrado" value={summary.deliveryRevenue} detail="Incluido en la ganancia bruta" icon={Truck} formatter={formatCurrency} />
        <MetricCard label="Comisiones liquidadas" value={summary.settledDeliveryCommission} detail="Sólo liquidaciones marcadas como pagadas" icon={WalletCards} formatter={formatCurrency} />
        <MetricCard label="Cancelaciones" value={summary.cancelledOrders} detail={`${(summary.cancellationRate * 100).toFixed(1)}% del total seleccionado`} icon={Ban} formatter={formatNumber} />
      </section>
      {isLoading ? <div className="mb-6 rounded-sm border border-neutral-200 bg-white p-12 text-center text-sm font-semibold text-neutral-500 shadow-sm">Procesando el reporte…</div> : <ReportTables dataset={filteredData} groups={groups} groupBy={groupBy} onGroupByChange={setGroupBy} />}
      <ReportExportDialog open={exportDialogOpen} hasFilteredData={Boolean(filteredData.orders.length)} exportingMode={exportingMode} onClose={() => { if (!exportingMode) setExportDialogOpen(false); }} onExport={(mode) => void handleExport(mode)} />
    </div>
  );
}
