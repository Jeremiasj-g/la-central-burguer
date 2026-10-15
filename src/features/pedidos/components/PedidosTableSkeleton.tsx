function SkeletonLine({ className = '' }: { className?: string }) {
  return <span className={`block rounded-lg bg-neutral-100 ${className}`} aria-hidden="true" />;
}

export function PedidosTableSkeleton() {
  return (
    <div role="status" aria-label="Cargando pedidos" className="min-w-0 animate-pulse motion-reduce:animate-none">
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[18px] border border-neutral-200/75 bg-white p-4">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-3">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="h-6 w-20 rounded-full" />
            </div>
            <SkeletonLine className="mt-4 h-4 w-36" />
            <SkeletonLine className="mt-2 h-3 w-28" />
            <SkeletonLine className="mt-4 h-3 w-full" />
            <SkeletonLine className="mt-2 h-3 w-3/4" />
            <SkeletonLine className="mt-4 h-16 w-full rounded-xl" />
            <div className="mt-4 flex items-end justify-between">
              <SkeletonLine className="h-6 w-24" />
              <SkeletonLine className="h-9 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white xl:block">
        <div className="grid grid-cols-5 gap-4 border-b border-neutral-100 bg-[#f8f8f9] px-5 py-4">
          {Array.from({ length: 5 }, (_, index) => <SkeletonLine key={index} className="h-3 w-16" />)}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid grid-cols-5 items-center gap-4 border-b border-neutral-100 px-5 py-5 last:border-b-0">
            <SkeletonLine className="h-4 w-3/4" />
            <SkeletonLine className="h-4 w-2/3" />
            <SkeletonLine className="h-6 w-24 rounded-full" />
            <SkeletonLine className="ml-auto h-4 w-20" />
            <SkeletonLine className="ml-auto h-9 w-9" />
          </div>
        ))}
      </div>
    </div>
  );
}
