'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCarrito } from '@/features/carrito/hooks/useCarrito';
import { ROUTES } from '@/shared/constants/routes';
import { PublicThemeToggle } from './PublicThemeProvider';

export function PublicHeader() {
  const cart = useCarrito();
  const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  function handleCartClick() {
    window.dispatchEvent(new CustomEvent('central-cart-open'));
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#111113]/95 text-[#f5f5f7] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[70px] max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link href={ROUTES.home} aria-label="Ir al inicio de Chetos" className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-[#ff933d] motion-reduce:transition-none">
          <Image src="/branding/chef-cutout.webp" width={50} height={40} alt="" className="h-10 w-12 object-contain" />
          <span className="text-xl font-semibold tracking-[-.045em] text-white">Chetos<span className="text-[#ff933d]">.</span></span>
        </Link>
        <nav aria-label="Navegación principal" className="hidden items-center gap-7 md:flex">
          <Link href={ROUTES.home} className="text-sm font-medium text-white/80 transition-transform duration-200 hover:scale-[1.04] motion-reduce:transition-none">Inicio</Link>
          <Link href="/#especialidades" className="text-sm font-medium text-white/70 transition-transform duration-200 hover:scale-[1.04] motion-reduce:transition-none">Especialidades</Link>
          <Link href="/#menu" className="text-sm font-medium text-white/70 transition-transform duration-200 hover:scale-[1.04] motion-reduce:transition-none">Menú</Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/#menu" className="rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-white transition-transform duration-200 hover:scale-[1.03] sm:hidden motion-reduce:transition-none">Menú</Link>
          <Link href="/#menu" className="hidden rounded-full bg-[#ff8730] px-5 py-2.5 text-sm font-semibold text-[#151311] transition-transform duration-200 hover:scale-[1.03] sm:inline-flex motion-reduce:transition-none">Hacer pedido</Link>
          <PublicThemeToggle />
          <button type="button" onClick={handleCartClick} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-white transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-[#ff933d] lg:hidden motion-reduce:transition-none" aria-label={cartCount > 0 ? 'Abrir carrito, ' + cartCount + ' productos' : 'Abrir carrito'} title="Carrito">
            <ShoppingCart size={20} strokeWidth={1.7} />
            {cartCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff8730] px-1 text-[10px] font-semibold text-[#151311]">{cartCount > 99 ? '99+' : cartCount}</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}
