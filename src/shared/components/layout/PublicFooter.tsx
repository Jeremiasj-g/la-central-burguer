'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, MapPin, Phone } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';

function externalUrl(value?: string, fallback = '#') {
  const trimmed = value?.trim();
  return trimmed ? (/^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed.replace(/^\/+/, '')) : fallback;
}

export function PublicFooter() {
  const { config } = useBusinessConfig();
  const phone = (config?.whatsappNumber || '').replace(/\D/g, '');
  const socialLinks = [
    { label: 'Instagram', href: externalUrl(config?.instagramUrl) },
    { label: 'Facebook', href: externalUrl(config?.facebookUrl) },
    { label: 'WhatsApp', href: externalUrl(config?.whatsappUrl, phone ? 'https://wa.me/' + phone : '#') },
  ].filter(link => link.href !== '#');

  return (
    <footer className="border-t border-white/10 bg-[#0b0b0d] px-5 py-14 text-[#f5f5f7] sm:px-8 sm:py-16">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 rounded-xl transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none">
            <Image src="/branding/chef-cutout.webp" width={100} height={76} alt="Chef de Chetos con una pizza y una hamburguesa" className="h-[76px] w-[100px] object-contain" />
            <div>
              <span className="block text-3xl font-semibold tracking-[-.06em]">Chetos<span className="text-[#ff933d]">.</span></span>
              <span className="mt-1 block text-xs font-normal text-white/55">Una obra maestra.</span>
            </div>
          </Link>
          <p className="mt-4 max-w-sm text-sm font-normal leading-6 text-white/50">Hamburguesas, lomitos, pizzas y tus comidas favoritas, hechas para disfrutar.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Explorá</p>
          <div className="mt-5 flex flex-col items-start gap-3 text-sm text-white/60">
            <Link href="/" className="transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">Inicio</Link>
            <Link href="/#especialidades" className="transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">Especialidades</Link>
            <Link href="/#menu" className="transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">Carta y pedidos</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Encontranos</p>
          <div className="mt-5 space-y-3 text-sm font-normal text-white/60">
            <p className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-[#ff933d]" strokeWidth={1.6} />{config?.address?.trim() || 'Corrientes, Argentina'}</p>
            {phone ? <a href={'https://wa.me/' + phone} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none"><Phone size={17} className="text-[#ff933d]" strokeWidth={1.6} />{phone}</a> : null}
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {socialLinks.map(link => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-white/70 transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">{link.label} <ArrowUpRight size={13} /></a>)}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-xs font-normal text-white/40">
        <span>© {new Date().getFullYear()} Chetos. Todos los derechos reservados.</span>
        <span>Desarrollado por <span className="font-medium text-white/65">@Devcor</span></span>
      </div>
    </footer>
  );
}
