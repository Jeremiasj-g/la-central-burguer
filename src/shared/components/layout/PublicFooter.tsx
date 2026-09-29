'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

const socialButtonBase = 'group relative grid h-12 w-12 place-items-center rounded-full border bg-[#11100f]/70 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11100f]';

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
            className={`${socialButtonBase} border-[#1877F2]/30 hover:border-[#1877F2] hover:bg-[#1877F2]/10 hover:shadow-[0_0_30px_rgba(24,119,242,.5)] focus-visible:ring-[#1877F2]`}
            href="#"
            aria-label="Facebook"
            title="Facebook"
          >
            <span className="absolute inset-1 rounded-full bg-[#1877F2]/0 blur-md transition duration-300 group-hover:bg-[#1877F2]/10" />
            <Image
              src="/social/facebook.svg"
              alt=""
              width={22}
              height={22}
              className="relative z-10 h-[22px] w-[22px] transition-transform duration-300 group-hover:scale-110"
            />
          </Link>

          <Link
            className={`${socialButtonBase} border-[#E1306C]/30 hover:border-[#E1306C] hover:bg-[#E1306C]/10 hover:shadow-[0_0_30px_rgba(225,48,108,.5)] focus-visible:ring-[#E1306C]`}
            href="#"
            aria-label="Instagram"
            title="Instagram"
          >
            <span className="absolute inset-1 rounded-full bg-[#E1306C]/0 blur-md transition duration-300 group-hover:bg-[#E1306C]/10" />
            <Image
              src="/social/instagram.svg"
              alt=""
              width={23}
              height={23}
              className="relative z-10 h-[23px] w-[23px] transition-transform duration-300 group-hover:scale-110"
            />
          </Link>

          <Link
            className={`${socialButtonBase} border-[#25D366]/30 hover:border-[#25D366] hover:bg-[#25D366]/10 hover:shadow-[0_0_30px_rgba(37,211,102,.48)] focus-visible:ring-[#25D366]`}
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            title="WhatsApp"
          >
            <span className="absolute inset-1 rounded-full bg-[#25D366]/0 blur-md transition duration-300 group-hover:bg-[#25D366]/10" />
            <Image
              src="/social/whatsapp.svg"
              alt=""
              width={23}
              height={23}
              className="relative z-10 h-[23px] w-[23px] transition-transform duration-300 group-hover:scale-110"
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
