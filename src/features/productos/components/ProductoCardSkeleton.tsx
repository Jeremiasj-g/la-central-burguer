import Skeleton from 'react-loading-skeleton';

export function ProductoCardSkeleton() {
  return (
    <div className="skeleton-dark rounded-sm border border-central-orange/20 bg-[#171514] p-5 shadow-dark">
      <div className="grid grid-cols-[34px_1fr_auto] gap-4">
        <Skeleton width={30} height={30} borderRadius={8} />
        <div>
          <Skeleton width={120} height={12} />
          <Skeleton className="mt-3" height={34} />
          <Skeleton className="mt-3" count={2} />
        </div>
        <Skeleton width={92} height={34} />
      </div>
      <Skeleton className="mt-5" height={1} />
    </div>
  );
}
