'use client';

import { useMemo } from 'react';
import { ChartSkeleton } from '@/features/dashboard/components/ChartSkeleton';
import { DeliveryMethodChart } from '@/features/dashboard/components/DeliveryMethodChart';
import { PaymentMethodsChart } from '@/features/dashboard/components/PaymentMethodsChart';
import { RevenueAreaChart } from '@/features/dashboard/components/RevenueAreaChart';
import { SalesByCategoryChart } from '@/features/dashboard/components/SalesByCategoryChart';
import { SalesByHourChart } from '@/features/dashboard/components/SalesByHourChart';
import { SalesLineChart } from '@/features/dashboard/components/SalesLineChart';
import { TopProductsBarChart } from '@/features/dashboard/components/TopProductsBarChart';
import { TopPromotionsBarChart } from '@/features/dashboard/components/TopPromotionsBarChart';
import type { ReportDataset, ReportFilters } from '../types/reporte.types';
import { buildReportChartData, getGranularityLabel } from '../utils/report-charts.utils';

interface ReportChartsProps {
  dataset: ReportDataset;
  filters: ReportFilters;
  periodLabel: string;
  isLoading?: boolean;
}

export function ReportCharts({
  dataset,
  filters,
  periodLabel,
  isLoading = false,
}: ReportChartsProps) {
  const charts = useMemo(
    () => buildReportChartData(dataset, filters),
    [dataset, filters],
  );

  const granularityLabel = getGranularityLabel(charts.granularity);
  const timelinePeriodLabel = `${periodLabel} · agrupado por ${granularityLabel}`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-4 rounded-sm border border-neutral-200 bg-white px-5 py-4 shadow-sm">
        <h3 className="text-base font-extrabold text-central-carbon">Análisis gráfico del período</h3>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Reutiliza las mismas visualizaciones del Dashboard, pero calculadas exclusivamente con los filtros aplicados en Reportes.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SalesLineChart data={charts.salesEvolution} periodLabel={timelinePeriodLabel} />
        <RevenueAreaChart
          data={charts.revenueByDay}
          periodLabel={timelinePeriodLabel}
          title={`Ingresos por ${granularityLabel}`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <TopProductsBarChart data={charts.topProducts} periodLabel={periodLabel} />
        <SalesByCategoryChart data={charts.salesByCategory} periodLabel={periodLabel} />
        <PaymentMethodsChart data={charts.paymentMethods} periodLabel={periodLabel} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <DeliveryMethodChart data={charts.deliveryMethods} periodLabel={periodLabel} />
        <TopPromotionsBarChart data={charts.topPromotions} periodLabel={periodLabel} />
        <SalesByHourChart data={charts.salesByHour} periodLabel={periodLabel} />
      </div>
    </section>
  );
}
