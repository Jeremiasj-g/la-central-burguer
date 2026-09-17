'use client';

import Link from 'next/link';
import { Menu, ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
import { useCarrito } from '@/features/carrito/hooks/useCarrito';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ROUTES } from '@/shared/constants/routes';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { config } = useBusinessConfig();
  const cart = useCarrito();
  const businessName = config?.businessName ?? 'La Central Burger';
  const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  const nav = [
    { label: 'Inicio', href: ROUTES.home },
    { label: 'Menú', href: '#menu' },
  ];

  function handleCartClick() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('central-cart-open'));
  }

  return (
    <header className="sticky top-0 z-40 min-h-[68px] sm:min-h-[72px] border-b border-central-orange/25 bg-[#0d0c0b]/88 text-central-cream shadow-dark backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`Ir al inicio de ${businessName}`}>
          <BusinessLogo logoUrl={config?.logoUrl} businessName={businessName} mode="navbar" />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-sm px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-central-cream/72 transition hover:bg-central-orange/10 hover:text-central-orange">
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="#menu" className="hidden rounded-sm bg-central-orange px-5 py-3 text-xs font-black uppercase tracking-[.18em] text-black shadow-orange transition hover:bg-central-cream md:inline-flex">
          Pedir ahora
        </Link>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={handleCartClick}
            className="relative grid h-10 w-10 place-items-center rounded-sm border border-central-orange/30 text-central-cream transition hover:border-central-orange hover:text-central-orange"
            aria-label={cartCount > 0 ? `Abrir carrito, ${cartCount} productos` : 'Abrir carrito'}
            title="Carrito"
          >
            <ShoppingCart size={21} className={cartCount > 0 ? 'lcb-bell-vibrate' : undefined} />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-central-orange px-1 text-[10px] font-black leading-none text-black ring-2 ring-[#0d0c0b]">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-sm border border-central-orange/30 text-central-cream transition hover:border-central-orange hover:text-central-orange"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-central-orange/20 bg-[#11100f] px-4 py-4 md:hidden">
          <nav className="grid gap-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-sm px-4 py-3 text-sm font-black uppercase tracking-wide text-central-cream/80 hover:bg-central-orange/10" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
