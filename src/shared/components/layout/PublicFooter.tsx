'use client';

import Link from 'next/link';
import { ArrowUpRight, MapPin, Phone } from 'lucide-react';
import { PublicBrandImage } from '@/features/configuracion/components/PublicBrandImage';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BUSINESS_CONFIG_DEFAULTS } from '@/features/configuracion/constants/configuracion.defaults';

function externalUrl(value?: string, fallback = '#') {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed.replace(/^\/+/, '');
}

export function PublicFooter() {
  const { config } = useBusinessConfig();
  const branding = config ?? BUSINESS_CONFIG_DEFAULTS;
  const phone = branding.whatsappNumber.replace(/\D/g, '');
  const socialLinks = [
    { label: 'Instagram', href: externalUrl(branding.instagramUrl) },
    { label: 'Facebook', href: externalUrl(branding.facebookUrl) },
    { label: 'WhatsApp', href: externalUrl(branding.whatsappUrl, phone ? 'https://wa.me/' + phone : '#') },
  ].filter(link => link.href !== '#');

  return (
    <footer className="border-t border-white/10 bg-[#0b0b0d] px-5 py-14 text-[#f5f5f7] sm:px-8 sm:py-16">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 rounded-xl transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none">
            <PublicBrandImage logoUrl={branding.logoUrl} businessName={branding.businessName} width={100} height={76}
              className="h-[76px] w-[100px] object-contain" />
            <div>
              <span className="block text-3xl font-semibold tracking-[-.06em]">
                {branding.businessName}<span className="text-[#ff933d]">.</span>
              </span>
              {branding.footerTagline.trim() && <span className="mt-1 block text-xs font-normal text-white/55">{branding.footerTagline}</span>}
            </div>
          </Link>
          {branding.footerDescription.trim() && (
            <p className="mt-4 max-w-sm text-sm font-normal leading-6 text-white/50">{branding.footerDescription}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{branding.footerLinksHeading}</p>
          <div className="mt-5 flex flex-col items-start gap-3 text-sm text-white/60">
            <Link href="/" className="transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">{branding.footerHomeLabel}</Link>
            <Link href="/#mas-vendidos" className="transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">{branding.footerBestSellersLabel}</Link>
            <Link href="/#menu" className="transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">{branding.footerMenuLabel}</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{branding.footerContactHeading}</p>
          <div className="mt-5 space-y-3 text-sm font-normal text-white/60">
            {branding.address.trim() && <p className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-[#ff933d]" strokeWidth={1.6} />{branding.address}</p>}
            {phone && <a href={'https://wa.me/' + phone} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none"><Phone size={17} className="text-[#ff933d]" strokeWidth={1.6} />{phone}</a>}
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {socialLinks.map(link => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-white/70 transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">{link.label} <ArrowUpRight size={13} /></a>)}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-xs font-normal text-white/40">
        <span>© {new Date().getFullYear()} {branding.businessName}. {branding.footerCopyright}</span>
        {branding.footerCredit.trim() && <span>{branding.footerCredit}</span>}
      </div>
    </footer>
  );
}
