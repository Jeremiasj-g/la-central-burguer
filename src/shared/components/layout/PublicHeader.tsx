'use client';

import Link from 'next/link';
import { ArrowUpRight, Menu, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { useCarrito } from '@/features/carrito/hooks/useCarrito';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';
import { useAnimatedPresence } from '@/shared/hooks/useAnimatedPresence';
import { PublicThemeSwitch } from './PublicThemeProvider';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const navMounted = useAnimatedPresence(open);
  const { config, isLoading } = useBusinessConfig();
  const { items } = useCarrito();
  const businessName = config?.businessName?.trim() || 'La Central Burger';
  const count = items.reduce((total, item) => total + item.quantity, 0);

  function openCart() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('central-cart-open'));
  }

  return (
    <header className="lcb-public-header sticky top-0 z-40">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-[80px] sm:px-7 lg:px-10">
        <Link href="/" className="lcb-header-brand flex min-w-0 items-center gap-2.5" aria-label={`Ir al inicio de ${businessName}`} onClick={() => setOpen(false)}>
          <BusinessLogo logoUrl={config?.logoUrl} businessName={businessName} mode="navbar" loading={isLoading} />
          <span className="hidden max-w-[175px] truncate text-[13px] font-semibold tracking-[-.02em] sm:block">{businessName}</span>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full p-1 md:flex" aria-label="Navegación principal">
          <Link className="lcb-header-link" href="/">Inicio</Link>
          <Link className="lcb-header-link" href="#menu">Carta</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <PublicThemeSwitch />
          <button className="lcb-cart-header-button" type="button" onClick={openCart}
            title="Abrir mi pedido" aria-label={count ? `Abrir carrito con ${count} productos` : 'Abrir carrito'}>
            <ShoppingBag size={18} strokeWidth={1.8} />
            <span className="hidden sm:inline">Mi pedido</span>
            {count > 0 ? <span className="lcb-cart-quantity" aria-live="polite">{count > 99 ? '99+' : count}</span> : null}
          </button>
          <a className="lcb-header-cta hidden lg:inline-flex" href="#menu">Pedir ahora <ArrowUpRight size={15} strokeWidth={1.8} /></a>
          <button type="button" onClick={() => setOpen(v => !v)} className="lcb-header-mobile-menu md:hidden"
            aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={open}>
            {open ? <X size={19}/> : <Menu size={19}/>}
          </button>
        </div>
      </div>
      {navMounted ? (
        <nav data-state={open ? 'open' : 'closed'} aria-label="Menú móvil" className={`lcb-mobile-nav ${!open ? 'pointer-events-none' : ''}`}>
          <Link onClick={() => setOpen(false)} href="/">Inicio</Link>
          <Link onClick={() => setOpen(false)} href="#menu">Explorar la carta</Link>
          <button type="button" onClick={openCart}>Ver mi pedido <ShoppingBag size={17}/></button>
        </nav>
      ) : null}
    </header>
  );
}
