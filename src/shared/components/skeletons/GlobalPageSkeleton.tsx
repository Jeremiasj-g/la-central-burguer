import Skeleton from 'react-loading-skeleton';

export function GlobalPageSkeleton() {
  return (
    <main className="skeleton-dark min-h-screen bg-central-carbon p-8">
      <div className="mx-auto max-w-7xl">
        <Skeleton height={48} width={280} borderRadius={18} />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Skeleton height={180} borderRadius={24} />
          <Skeleton height={180} borderRadius={24} />
          <Skeleton height={180} borderRadius={24} />
        </div>
        <div className="mt-8">
          <Skeleton height={420} borderRadius={28} />
        </div>
      </div>
    </main>
  );
}
