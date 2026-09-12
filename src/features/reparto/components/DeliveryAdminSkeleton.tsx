import Skeleton from 'react-loading-skeleton';

export function DeliveryAdminSkeleton() {
  return (
    <div>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton width={100} />
            <Skeleton className="mt-3" width={120} height={30} />
            <Skeleton className="mt-2" width="85%" />
          </div>
        ))}
      </section>
      <div className="mb-6 rounded-sm border border-neutral-200 bg-white p-2 shadow-sm">
        <Skeleton height={40} width={320} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton width={170} height={22} />
            <Skeleton className="mt-2" width={240} />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((__, row) => (
                <Skeleton key={row} height={110} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
