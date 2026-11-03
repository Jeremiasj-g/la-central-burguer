import Skeleton from 'react-loading-skeleton';

/**
 * Mantiene la silueta real de la tarjeta Chetos mientras se cargan productos,
 * con el mismo shimmer de react-loading-skeleton que utiliza La Central.
 */
export function ProductoCardSkeleton() {
  return (
    <div
      className="chet-product-skeleton skeleton-dark flex min-w-0 flex-col overflow-hidden rounded-[23px] bg-[#1b1b1e]"
      aria-hidden="true"
    >
      <div className="aspect-[1.55] w-full overflow-hidden bg-[#242327] sm:aspect-[1.6]">
        <Skeleton width="100%" height="100%" borderRadius={0} containerClassName="block h-full w-full leading-none" />
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <Skeleton width={88} height={12} borderRadius={6} />
        <Skeleton className="mt-2" width="80%" height={24} borderRadius={8} />
        <div className="mt-3">
          <Skeleton height={12} count={2} borderRadius={6} />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <Skeleton width={104} height={24} borderRadius={8} />
          <Skeleton width={40} height={40} circle />
        </div>
      </div>
    </div>
  );
}
