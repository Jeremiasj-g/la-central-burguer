'use client';

import { Button } from '@/shared/components/ui/Button';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-central-cream px-6">
      <section className="max-w-md rounded-sm bg-white p-8 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[.25em] text-central-orange">Error</p>
        <h1 className="mt-3 text-3xl font-black text-central-carbon">Algo no salió bien</h1>
        <p className="mt-3 text-sm text-neutral-600">Probá recargar la pantalla. Si sigue pasando, revisá la consola del proyecto.</p>
        <Button className="mt-6" onClick={reset}>Reintentar</Button>
      </section>
    </main>
  );
}
