'use client';

import { useDashboardStats } from '../hooks/useDashboardStats';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { ChartSkeleton } from '../components/ChartSkeleton';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardMetricCardSkeleton } from '../components/DashboardMetricCardSkeleton';
import { DeliveryMethodChart } from '../components/DeliveryMethodChart';
import { PaymentMethodsChart } from '../components/PaymentMethodsChart';
import { RecentOrdersTable } from '../components/RecentOrdersTable';
import { RecentOrdersTableSkeleton } from '../components/RecentOrdersTableSkeleton';
import { RevenueAreaChart } from '../components/RevenueAreaChart';
import { SalesByCategoryChart } from '../components/SalesByCategoryChart';
import { SalesByHourChart } from '../components/SalesByHourChart';
import { SalesLineChart } from '../components/SalesLineChart';
import { TopProductsBarChart } from '../components/TopProductsBarChart';
import { TopPromotionsBarChart } from '../components/TopPromotionsBarChart';
import { getDashboardPeriodLabels } from '../utils/dashboard-period.utils';

export function DashboardPage() {
  const { stats, isLoading, error } = useDashboardStats();
  const periods = getDashboardPeriodLabels();

  return (
    <div>
      <AdminPageHeader eyebrow="Dashboard" title="Resumen de ventas" description="Indicadores principales, pedidos recientes y gráficos calculados desde los pedidos registrados." />
      {error ? <div className="rounded-sm bg-red-50 p-5 text-red-700">{error}</div> : null}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !stats ? Array.from({ length: 4 }).map((_, index) => <DashboardMetricCardSkeleton key={index} />) : stats.metrics.map((metric) => <DashboardMetricCard key={metric.label} metric={metric} />)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {isLoading || !stats ? <><ChartSkeleton /><ChartSkeleton /></> : <><SalesLineChart data={stats.salesEvolution} periodLabel={periods.last7Days} /><RevenueAreaChart data={stats.revenueByDay} periodLabel={periods.last30Days} /></>}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {isLoading || !stats ? <><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /></> : <><TopProductsBarChart data={stats.topProducts} periodLabel={periods.last30Days} /><SalesByCategoryChart data={stats.salesByCategory} periodLabel={periods.last30Days} /><PaymentMethodsChart data={stats.paymentMethods} periodLabel={periods.last30Days} /></>}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {isLoading || !stats ? <><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /></> : <><DeliveryMethodChart data={stats.deliveryMethods} periodLabel={periods.last30Days} /><TopPromotionsBarChart data={stats.topPromotions} periodLabel={periods.last30Days} /><SalesByHourChart data={stats.salesByHour} periodLabel={periods.last30Days} /></>}
      </div>
      <div className="mt-6">
        {isLoading || !stats ? <RecentOrdersTableSkeleton /> : <RecentOrdersTable orders={stats.recentOrders} />}
      </div>
    </div>
  );
}
