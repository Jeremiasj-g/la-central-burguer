import Skeleton from 'react-loading-skeleton';

export function DashboardMetricCardSkeleton() {
  return (
    <div className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-5 shadow-soft">
      <Skeleton width={120} />
      <Skeleton className="mt-3" height={34} width={150} />
      <Skeleton className="mt-3" width={190} />
    </div>
  );
}
