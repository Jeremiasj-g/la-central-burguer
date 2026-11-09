import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#111111] px-4 py-12 text-[#f6f4f0] sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,178,26,.12),transparent_55%),linear-gradient(180deg,#161616_0%,#111111_75%)]" />
      <section className="relative w-full max-w-[520px] text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-[16px] border border-[#ffb21a]/30 bg-[#ffb21a]/10 text-[#ffb21a]">
          <SearchX size={26} strokeWidth={1.7} />
        </div>
        <p className="text-[13px] font-medium tracking-[.14em] text-[#ffb21a]">ERROR 404</p>
        <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-.045em] text-white sm:text-[40px]">
          Esta página no está en el menú
        </h1>
        <Link href="/" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[#ffb21a] px-6 text-[13px] font-semibold text-[#17130e] transition-colors duration-200 hover:bg-[#ffc44c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb21a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]">
          <ArrowLeft size={16} strokeWidth={1.8} /> Volver al inicio
        </Link>
      </section>
    </main>
  );
}
