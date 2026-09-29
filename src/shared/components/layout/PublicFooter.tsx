'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

const socialButtonBase = 'grid h-12 w-12 place-items-center rounded-full border bg-[#11100f]/75 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-sm transition-transform duration-200 ease-out hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11100f]';

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

        <div className="mt-8 flex justify-center gap-4">
          <Link
            className={`${socialButtonBase} border-[#1877F2]/55 focus-visible:ring-[#1877F2]`}
            href="#"
            aria-label="Facebook"
            title="Facebook"
          >
            <span
              aria-hidden="true"
              className="h-6 w-6"
              style={{
                backgroundColor: '#1877F2',
                WebkitMaskImage: 'url("/social/facebook.svg")',
                maskImage: 'url("/social/facebook.svg")',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
            />
          </Link>

          <Link
            className={`${socialButtonBase} border-[#E1306C]/55 focus-visible:ring-[#E1306C]`}
            href="#"
            aria-label="Instagram"
            title="Instagram"
          >
            <span
              aria-hidden="true"
              className="h-6 w-6"
              style={{
                backgroundColor: '#E1306C',
                WebkitMaskImage: 'url("/social/instagram.svg")',
                maskImage: 'url("/social/instagram.svg")',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
            />
          </Link>

          <Link
            className={`${socialButtonBase} border-[#25D366]/55 focus-visible:ring-[#25D366]`}
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            title="WhatsApp"
          >
            <span
              aria-hidden="true"
              className="h-6 w-6"
              style={{
                backgroundColor: '#25D366',
                WebkitMaskImage: 'url("/social/whatsapp.svg")',
                maskImage: 'url("/social/whatsapp.svg")',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
            />
          </Link>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-central-cream/65">
          <MapPin size={16} /> {address} · Corrientes, Argentina
        </p>
        <p className="mt-2 text-sm text-central-cream/45">Copyright © 2026 {businessName}. Todos los derechos reservados.</p>
        <p className="mt-2 text-sm text-central-cream/45">Desarrollado por <span className="font-bold text-central-orange">@Devcor</span></p>
      </div>
    </footer>
  );
}
