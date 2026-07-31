import Link from 'next/link';
import { Button } from '@/shared/components/ui/Button';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-central-carbon px-6 text-white">
      <section className="max-w-md rounded-sm border border-white/10 bg-white/5 p-8 text-center shadow-dark">
        <p className="text-sm font-semibold uppercase tracking-[.25em] text-central-orange">404</p>
        <h1 className="mt-3 text-3xl font-black">Esta página no está en el menú</h1>
        <p className="mt-3 text-sm text-white/60">Volvé al inicio para seguir navegando por La Central Burger.</p>
        <Button asChild className="mt-6">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </section>
    </main>
  );
}
