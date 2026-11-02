import Skeleton from 'react-loading-skeleton';

export function ProductoCardSkeleton() {
  return (
    <div className="chet-product-card skeleton-dark overflow-hidden rounded-[23px] border border-white/10 bg-[#1b1b1e]">
      <Skeleton height={200} borderRadius={0} />
      <div className="space-y-3 p-5">
        <Skeleton width={90} height={12} />
        <Skeleton width="72%" height={24} />
        <Skeleton count={2} height={12} />
        <Skeleton width={110} height={24} />
      </div>
    </div>
  );
}
