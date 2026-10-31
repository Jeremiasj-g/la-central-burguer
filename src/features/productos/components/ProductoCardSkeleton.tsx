import Skeleton from 'react-loading-skeleton';

// Las formas del skeleton coinciden con las tarjetas reales del menú.
export function ProductoCardSkeleton() {
  return (
    <div className="lcb-product-skeleton skeleton-dark relative min-h-[160px] overflow-hidden rounded-[17px] bg-[#20201f] shadow-2xl sm:min-h-[170px]" aria-hidden="true">
      <div className="absolute inset-y-0 right-0 w-[40%] overflow-hidden bg-[#171514] sm:w-[38%]">
        <Skeleton width="100%" height="100%" borderRadius={0} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#171514] via-[#171514]/65 to-transparent" />
      </div>
      <div className="relative z-10 flex min-h-[160px] max-w-[72%] flex-col justify-between p-4 pr-2 sm:min-h-[170px] sm:max-w-[68%]">
        <div>
          <Skeleton width="48%" height={10} />
          <Skeleton width="83%" height={18} className="mt-2" />
          <Skeleton width="94%" height={10} className="mt-3" />
          <Skeleton width="77%" height={10} className="mt-1" />
        </div>
        <Skeleton width="48%" height={19} className="mt-3" />
      </div>
    </div>
  );
}
