import Skeleton from 'react-loading-skeleton';

export function DeliveryAdminSkeleton() {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[23px] bg-[#191b20] px-6 py-7">
        <Skeleton baseColor="#303238" highlightColor="#44464c" width={155} height={12} />
        <Skeleton baseColor="#303238" highlightColor="#44464c" className="mt-4" width={260} height={50} />
        <div className="mt-5 border-t border-white/10 pt-4">
          <Skeleton baseColor="#303238" highlightColor="#44464c" width={210} height={16} />
        </div>
      </div>
      <div className="grid overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-b border-neutral-100 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <Skeleton width={120} height={14} />
            <Skeleton className="mt-3" width={75} height={32} />
            <Skeleton className="mt-2" width="80%" height={13} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 py-4">
        <Skeleton width={180} height={24} />
        <Skeleton width={280} height={36} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[20px] border border-neutral-200/70 bg-white p-5">
            <Skeleton width={170} height={20} />
            <Skeleton className="mt-2" width={220} height={13} />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 3 }).map((__, row) => (
                <div key={row} className="border-b border-neutral-100 pb-4">
                  <Skeleton width="65%" height={15} />
                  <Skeleton className="mt-3" width="85%" height={12} />
                  <Skeleton className="mt-3" width="100%" height={32} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
