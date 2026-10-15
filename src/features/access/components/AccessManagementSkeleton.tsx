import Skeleton from 'react-loading-skeleton';

export function AccessManagementSkeleton() {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[23px] bg-[#191b20] px-6 py-7">
        <Skeleton baseColor="#303238" highlightColor="#44464c" width={170} height={13} />
        <Skeleton baseColor="#303238" highlightColor="#44464c" className="mt-4" width={140} height={50} />
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index}><Skeleton baseColor="#303238" highlightColor="#44464c" height={12} width={65} /><Skeleton baseColor="#303238" highlightColor="#44464c" className="mt-2" height={24} width={36} /></div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 py-4">
        <Skeleton width={170} height={23} />
        <Skeleton width={230} height={36} />
      </div>
      <div className="rounded-[20px] border border-neutral-200/70 bg-white p-5">
        <Skeleton width={220} height={20} />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="border-b border-neutral-100 pb-4">
              <Skeleton width="60%" height={14} />
              <Skeleton className="mt-2" width="45%" height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
