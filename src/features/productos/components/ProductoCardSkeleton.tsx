export function ProductoCardSkeleton() {
  return (
    <div role="status" aria-label="Cargando producto" className="lcb-menu-product min-w-0 animate-pulse overflow-hidden motion-reduce:animate-none">
      <div className="aspect-[1.33] bg-[var(--lcb-hover)]"/>
      <div className="space-y-3 px-5 pb-6 pt-5">
        <div className="h-3 w-1/3 rounded-full bg-[var(--lcb-hover)]"/>
        <div className="h-5 w-4/5 rounded-full bg-[var(--lcb-hover)]"/>
        <div className="h-4 w-full rounded-full bg-[var(--lcb-hover)]"/>
        <div className="h-5 w-1/2 rounded-full bg-[var(--lcb-hover)]"/>
      </div>
    </div>
  );
}
