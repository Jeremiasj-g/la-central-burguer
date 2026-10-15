// Validación CI temporal del diseño Productos wallet.
export function ProductoTableSkeleton() {
  return (
    <div role="status" aria-label="Cargando productos" className="min-w-0 animate-pulse motion-reduce:animate-none">
      <div className="grid gap-3 sm:grid-cols-2 2xl:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-[18px] border border-neutral-200/75 bg-white">
            <div className="flex gap-3 p-4">
              <div className="h-[76px] w-[76px] shrink-0 rounded-[13px] bg-neutral-100" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-3 w-2/5 rounded-lg bg-neutral-100" />
                <div className="h-4 w-4/5 rounded-lg bg-neutral-100" />
                <div className="h-5 w-1/2 rounded-lg bg-neutral-100" />
              </div>
            </div>
            <div className="space-y-2 px-4">
              <div className="h-3 w-full rounded-lg bg-neutral-100" />
              <div className="h-3 w-3/4 rounded-lg bg-neutral-100" />
              <div className="mt-4 flex gap-2 pb-3">
                <div className="h-6 w-16 rounded-full bg-neutral-100" />
                <div className="h-6 w-24 rounded-full bg-neutral-100" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 border-t border-neutral-100 bg-[#fafafa] px-4 py-3">
              {Array.from({ length: 5 }, (_, itemIndex) => <div key={itemIndex} className="h-8 w-8 rounded-[9px] bg-neutral-100" />)}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white 2xl:block">
        <div className="grid grid-cols-6 gap-4 border-b border-neutral-100 bg-[#f8f8f9] px-5 py-4">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-3 w-20 max-w-full rounded-lg bg-neutral-100" />)}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid grid-cols-6 items-center gap-4 border-b border-neutral-100 px-5 py-5 last:border-b-0">
            <div className="h-12 w-32 max-w-full rounded-lg bg-neutral-100" />
            <div className="h-4 w-20 max-w-full rounded-lg bg-neutral-100" />
            <div className="h-4 w-24 max-w-full rounded-lg bg-neutral-100" />
            <div className="h-4 w-16 max-w-full rounded-lg bg-neutral-100" />
            <div className="h-6 w-24 max-w-full rounded-full bg-neutral-100" />
            <div className="h-9 w-full rounded-[10px] bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
