'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock3, Instagram, Facebook, MapPin, MessageCircle, MoveUpRight } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';

function urlOrFallback(value: string | undefined, fallback: string) {
  const v = value?.trim();
  if (!v) return fallback;
  return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`;
}

export function PublicFooter() {
  const { config } = useBusinessConfig();
  const name = config?.businessName?.trim() || 'La Central Burger';
  const address = config?.address?.trim() || 'Madariaga 246';
  const whatsapp = (config?.whatsappNumber || '543794752707').replace(/\D/g, '');
  const links = [
    { title: 'Instagram', href: urlOrFallback(config?.instagramUrl, '#'), Icon: Instagram },
    { title: 'Facebook', href: urlOrFallback(config?.facebookUrl, '#'), Icon: Facebook },
    { title: 'WhatsApp', href: urlOrFallback(config?.whatsappUrl, `https://wa.me/${whatsapp}`), Icon: MessageCircle },
  ];
  return (
    <footer className="lcb-public-footer">
      <div className="mx-auto max-w-[1440px] px-5 pb-7 pt-12 sm:px-8 sm:pt-16 lg:px-12">
        <div className="grid gap-10 border-b border-current/10 pb-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-20">
          <div className="max-w-xl">
            <p className="lcb-section-eyebrow">Sabor que nos encuentra</p>
            <h2 className="mt-4 max-w-lg text-[clamp(2.2rem,5vw,4.8rem)] font-semibold leading-[1.05] tracking-[-.06em]">{name}<span className="text-[var(--lcb-accent)]">.</span></h2>
            <p className="mt-5 max-w-sm text-[14px] leading-7 text-[var(--lcb-muted)]">Elegí lo que te gusta, armá tu pedido y disfrutá de La Central a tu manera.</p>
            <Link href="#menu" className="lcb-footer-order mt-6 inline-flex items-center gap-2">Volver a la carta <ArrowUpRight size={17}/></Link>
          </div>
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
            <div>
              <p className="lcb-footer-heading">Encontranos</p>
              <p className="mt-3 flex items-start gap-2 text-[13px] leading-6 text-[var(--lcb-muted)]"><MapPin size={16} className="mt-1 shrink-0 text-[var(--lcb-accent)]"/>{address}, Corrientes</p>
              <p className="mt-4 flex items-center gap-2 text-[12px] text-[var(--lcb-muted)]"><Clock3 size={15}/> Consultá disponibilidad en el menú</p>
            </div>
            <div>
              <p className="lcb-footer-heading">Conectemos</p>
              <div className="mt-3 flex flex-col gap-2">
                {links.filter(link=>link.href!=='#').map(({ title, href, Icon })=> (
                  <a key={title} href={href} target="_blank" rel="noreferrer" className="lcb-footer-social">
                    <Icon size={15} strokeWidth={1.8}/>{title}<MoveUpRight size={13} className="ml-auto opacity-40"/>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-6 text-[11px] text-[var(--lcb-muted)]">
          <span>© {new Date().getFullYear()} {name}. Todos los derechos reservados.</span>
          <span>Hecho con pasión en Corrientes · Desarrollado por @Devcor</span>
        </div>
      </div>
    </footer>
  );
}
