'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ROUTES } from '@/shared/constants/routes';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';


export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { config } = useBusinessConfig();
  const businessName = config?.businessName ?? 'La Central Burger';

  const nav = [
    { label: 'Inicio', href: ROUTES.home },
    { label: 'Menú', href: '#menu' },
  ];

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

        <button className="rounded-sm border border-central-orange/30 p-2 text-central-cream md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Abrir menú">
          {open ? <X /> : <Menu />}
        </button>
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
