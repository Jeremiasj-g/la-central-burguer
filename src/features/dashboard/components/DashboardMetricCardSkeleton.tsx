import Skeleton from 'react-loading-skeleton';

export function DashboardMetricCardSkeleton() {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white p-6 shadow-soft">
      <Skeleton width={120} />
      <Skeleton className="mt-3" height={34} width={150} />
      <Skeleton className="mt-3" width={190} />
    </div>
  );
}
