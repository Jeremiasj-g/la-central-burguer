'use client';

import Link from 'next/link';
import { BookOpenText, ShoppingCart, UserRound } from 'lucide-react';
import { useCustomerAuth } from '@/features/clientes/components/CustomerAuthProvider';
import { useCarrito } from '@/features/carrito/hooks/useCarrito';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ROUTES } from '@/shared/constants/routes';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';
import { CustomerGoogleAvatar } from '@/features/clientes/components/CustomerGoogleAvatar';
import { PublicThemeToggle } from './PublicThemeProvider';

export function PublicHeader() {
  const { config, isLoading } = useBusinessConfig();
  const cart = useCarrito();
  const {user,openAuth}=useCustomerAuth();
  const businessName = config?.businessName ?? 'La Central Burger';
  const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  function handleCartClick() {
    window.dispatchEvent(new CustomEvent('central-cart-open'));
  }

  return (
    <header className="lcb-public-header sticky top-0 z-40 border-b border-central-orange/25 bg-[#0d0c0b]/88 text-central-cream shadow-dark backdrop-blur-xl">
      <div className="mx-auto flex min-h-[68px] w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-2 sm:min-h-[72px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5 lg:gap-8">
          <Link
            href={ROUTES.home}
            className="inline-flex shrink-0 items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-central-orange"
            aria-label={`Ir al inicio de ${businessName}`}
            title="Ir al inicio"
          >
            <BusinessLogo logoUrl={config?.logoUrl} businessName={businessName} mode="navbar" loading={isLoading} />
          </Link>

        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
          <span className="lcb-public-header-theme"><PublicThemeToggle /></span>
          <Link
            href="#menu"
            aria-label="Ver carta"
            title="Ver carta"
            className="lcb-public-header-action inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[.035] text-central-cream transition-colors duration-200 hover:border-central-orange/50 hover:text-central-orange md:hidden"
          >
            <BookOpenText size={19} aria-hidden="true"/>
          </Link>

          <Link
            href="#menu"
            className="hidden h-10 items-center justify-center rounded-[11px] bg-central-orange px-5 text-[12px] font-semibold text-black shadow-orange transition-colors duration-200 hover:bg-central-cream lg:inline-flex"
          >
            Pedir ahora
          </Link>

          <button
            type="button"
            onClick={handleCartClick}
            className="lcb-public-header-action relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[.035] text-central-cream transition-colors duration-200 hover:border-central-orange/50 hover:text-central-orange lg:hidden"
            aria-label={cartCount > 0 ? `Abrir carrito, ${cartCount} productos` : 'Abrir carrito'}
            title="Carrito"
          >
            <ShoppingCart size={21} className={cartCount > 0 ? 'lcb-bell-vibrate' : undefined} />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-central-orange px-1 text-[10px] font-semibold leading-none text-black ring-2 ring-[#0d0c0b]">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </button>

          {user ? (
            <Link href="/mi-cuenta" title="Mi cuenta" aria-label="Ir a mi cuenta"
              className="lcb-public-header-action lcb-public-header-avatar lcb-public-header-avatar-photo inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange">
              <CustomerGoogleAvatar user={user} compact/>
            </Link>
          ) : (
            <button type="button" onClick={()=>openAuth('header')} title="Iniciar sesión" aria-label="Iniciar sesión"
              className="lcb-public-header-action lcb-public-header-avatar inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[.035] text-white transition-colors duration-200 hover:border-central-orange/50 hover:text-central-orange focus-visible:outline-2 focus-visible:outline-central-orange">
              <UserRound size={18}/>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
