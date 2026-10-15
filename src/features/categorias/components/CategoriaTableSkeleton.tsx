// Validación temporal CI del rediseño de catálogo.
export function CategoriaTableSkeleton() {
  return (
    <div role="status" aria-label="Cargando categorías" className="min-w-0 animate-pulse motion-reduce:animate-none">
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[17px] border border-neutral-200/75 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="h-9 w-9 rounded-[11px] bg-neutral-100" />
              <div className="h-6 w-20 rounded-full bg-neutral-100" />
            </div>
            <div className="mt-4 h-4 w-32 rounded-lg bg-neutral-100" />
            <div className="mt-2 h-3 w-48 max-w-full rounded-lg bg-neutral-100" />
            <div className="mt-4 h-16 w-full rounded-[12px] bg-neutral-100" />
            <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
              <div className="h-4 w-24 rounded-lg bg-neutral-100" />
              <div className="h-9 w-28 rounded-[10px] bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white xl:block">
        <div className="flex gap-6 border-b border-neutral-100 bg-[#f8f8f9] px-5 py-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-3 w-20 rounded-lg bg-neutral-100" />)}
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-5 last:border-b-0">
            <div className="h-4 w-40 rounded-lg bg-neutral-100" />
            <div className="h-4 w-16 rounded-lg bg-neutral-100" />
            <div className="h-6 w-20 rounded-full bg-neutral-100" />
            <div className="h-9 w-28 rounded-[10px] bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
