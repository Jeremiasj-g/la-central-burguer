import Skeleton from 'react-loading-skeleton';

export function AccessManagementSkeleton() {
  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton width={110} />
            <Skeleton className="mt-3" height={30} width={90} />
            <Skeleton className="mt-2" width="80%" />
          </div>
        ))}
      </div>
      <div className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton width={280} height={40} />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} height={180} />)}
        </div>
      </div>
    </div>
  );
}
