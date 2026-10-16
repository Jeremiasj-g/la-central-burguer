'use client';

import Link from 'next/link';
import { Menu, ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
import { useCarrito } from '@/features/carrito/hooks/useCarrito';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ROUTES } from '@/shared/constants/routes';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';
import { useAnimatedPresence } from '@/shared/hooks/useAnimatedPresence';
import { CustomerThemeToggle } from './CustomerThemeProvider';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const navMounted = useAnimatedPresence(open);
  const { config, isLoading } = useBusinessConfig();
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
    <header className="lcb-polished-header sticky top-0 z-40 min-h-[72px] border-b backdrop-blur-[10px] sm:min-h-[78px]">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 px-4 py-3 sm:px-7 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`Ir al inicio de ${businessName}`}>
          <BusinessLogo logoUrl={config?.logoUrl} businessName={businessName} mode="navbar" loading={isLoading} />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="lcb-polished-nav-link rounded-[11px] px-4 py-2.5 text-[12px] font-medium transition-colors duration-200">
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="#menu" className="lcb-polished-header-cta hidden items-center rounded-[12px] px-5 py-3 text-[12px] font-semibold transition-all duration-200 md:inline-flex">
          Pedir ahora
        </Link>

        <div className="flex shrink-0 items-center gap-2"><CustomerThemeToggle /><div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={handleCartClick}
            className="lcb-polished-nav-icon relative grid h-10 w-10 place-items-center rounded-[11px] border transition-colors duration-200"
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
            className="lcb-polished-nav-icon grid h-10 w-10 place-items-center rounded-[11px] border transition-colors duration-200"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          </div>
        </div>
      </div>

      {navMounted ? (
        <div data-state={open ? 'open' : 'closed'} aria-hidden={!open} className={`lcb-mobile-nav lcb-polished-mobile-menu overflow-hidden border-t px-4 py-4 md:hidden ${!open ? 'pointer-events-none' : ''}`}>
          <nav className="grid gap-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="lcb-polished-mobile-link rounded-[11px] px-4 py-3 text-[13px] font-medium transition-colors duration-200" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
