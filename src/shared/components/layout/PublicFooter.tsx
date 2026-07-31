'use client';

import Link from 'next/link';
import { Camera, MapPin, MessageCircle } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

export function PublicFooter() {
  const { config } = useBusinessConfig();
  const businessName = config?.businessName?.trim() || 'La Central Burger';
  const whatsapp = (config?.whatsappNumber || '543794752707').replace(/\D/g, '');
  const address = config?.address?.trim() || 'Madariaga 246';

  return (
    <footer className="brick-wall relative overflow-hidden border-t border-central-orange/25 px-4 py-16 text-central-cream sm:px-6 lg:px-8">
      <div className="absolute right-0 top-8 h-[75%] w-1 rounded-l-full bg-central-orange" />
      <div className="pointer-events-none absolute left-8 top-10 hidden text-[70px] watermark-text lg:block">{businessName}</div>
      <div className="mx-auto max-w-7xl text-center">
        <div className="brand-stamp mx-auto mb-8 h-28 w-28 overflow-hidden">
          <BusinessLogo logoUrl={config?.logoUrl} businessName={businessName} mode="stamp" />
        </div>
        <h2 className="menu-title-shadow font-display text-5xl uppercase tracking-wide text-central-orange sm:text-6xl">{businessName}</h2>
        <div className="brush-line mx-auto mt-5" />
        <div className="mt-8 flex justify-center gap-4 text-central-orange">
          <Link className="grid h-12 w-12 place-items-center rounded-full border border-central-orange/40 text-xl font-black transition hover:bg-central-orange hover:text-black" href="#" aria-label="Facebook">f</Link>
          <Link className="grid h-12 w-12 place-items-center rounded-full border border-central-orange/40 transition hover:bg-central-orange hover:text-black" href="#" aria-label="Instagram"><Camera /></Link>
          <Link className="rounded-full border border-central-orange/40 p-3 transition hover:bg-central-orange hover:text-black" href={`https://wa.me/${whatsapp}`} aria-label="WhatsApp"><MessageCircle /></Link>
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-central-cream/65"><MapPin size={16} /> {address} · Corrientes, Argentina</p>
        <p className="mt-2 text-sm text-central-cream/45">Copyright © 2026 {businessName}. Todos los derechos reservados.</p>
        <p className="mt-2 text-sm text-central-cream/45">Desarrollado por <span className="font-bold text-central-orange">@Devcor</span></p>
      </div>
    </footer>
  );
}
