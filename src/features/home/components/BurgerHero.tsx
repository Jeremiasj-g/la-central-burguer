'use client';

import Link from 'next/link';
import { ArrowDown, Flame, MapPin } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { isBusinessOpenBySchedule } from '@/features/configuracion/utils/businessStatus.utils';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

function formatPhoneForDisplay(phone?: string) {
  if (!phone) return 'Sin WhatsApp';
  return phone.replace(/^54/, '').replace(/\D/g, '') || phone;
}


export function BurgerHero() {
  const { config } = useBusinessConfig();
  const isOpen = config ? isBusinessOpenBySchedule(config) : false;
  const businessName = config?.businessName ?? 'La Central Burger';
  const words = businessName.trim().split(/\s+/);
  const lastWord = words.pop() ?? '';
  const firstWords = words.join(' ') || lastWord;

  return (
    <section className="brick-wall grunge-border relative min-h-[720px] overflow-hidden px-4 py-20 text-central-cream sm:px-6 lg:px-8 lg:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(216,137,24,.18),transparent_30rem),linear-gradient(90deg,rgba(0,0,0,.30),transparent_45%,rgba(0,0,0,.34))]" />
      <div className="pointer-events-none absolute left-6 top-28 hidden text-[88px] watermark-text lg:block">{config?.businessName ?? 'La Central Burger'}</div>
      <div className="pointer-events-none absolute -right-24 top-28 hidden h-[380px] w-[380px] rounded-full border-[28px] border-central-cream/5 xl:block" />
      <div className="pointer-events-none absolute bottom-0 right-0 hidden h-[290px] w-[520px] rounded-tl-[80px] bg-[radial-gradient(circle_at_60%_45%,rgba(216,137,24,.38),rgba(216,137,24,.08)_42%,transparent_70%)] blur-sm lg:block" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center text-center">
        <div className="brand-stamp h-32 w-32 overflow-hidden sm:h-40 sm:w-40">
          <BusinessLogo logoUrl={config?.logoUrl} businessName={businessName} mode="stamp" />
        </div>

        <div className={`mt-12 inline-flex items-center gap-2 rounded-sm border-2 bg-black/45 px-5 py-2.5 text-xs font-black uppercase tracking-[.28em] shadow-dark backdrop-blur ${isOpen ? 'border-emerald-400/80 text-emerald-300 shadow-[0_0_28px_rgba(52,211,153,.18)]' : 'border-red-400/80 text-red-300 shadow-[0_0_28px_rgba(248,113,113,.15)]'}`}>
          <Flame size={15} /> {isOpen ? 'Abierto ahora' : 'Cerrado ahora'}
        </div>

        <h1 className="menu-title-shadow mt-7 max-w-5xl font-display text-6xl uppercase leading-[.82] tracking-wide text-central-cream sm:text-8xl lg:text-[9.5rem]">
          {firstWords}<br />{lastWord ? <span className="text-central-orange">{lastWord}</span> : null}
        </h1>
        <div className="brush-line mx-auto mt-7" />
        <p className="mt-8 max-w-3xl text-lg font-semibold leading-8 text-central-cream/80 sm:text-xl">
          {config?.heroDescription ?? 'Hamburguesas, lomitos, sándwichs de milanesa, figazzas, pizzas y milanesas XXL. Sabor bien cargado, papas fritas y pedidos rápidos por WhatsApp.'}
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="#menu" className="inline-flex h-14 items-center justify-center gap-2 rounded-sm bg-central-orange px-7 text-sm font-black uppercase tracking-wide text-black shadow-orange transition hover:bg-central-cream">
            Ver menú <ArrowDown size={18} />
          </Link>
        </div>

        <div className="mt-12 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-central-orange/25 bg-black/35 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[.25em] text-central-orange">WhatsApp</p>
            <p className="mt-1 text-xl font-black">{formatPhoneForDisplay(config?.whatsappNumber)}</p>
          </div>
          <div className="rounded-sm border border-central-orange/25 bg-black/35 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[.25em] text-central-orange">Dirección</p>
            <p className="mt-1 flex items-center justify-center gap-2 text-xl font-black"><MapPin size={18} /> {config?.address ?? 'Madariaga 246'}</p>
          </div>
          <div className="rounded-sm border border-central-orange/25 bg-black/35 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[.25em] text-central-orange">Especialidad</p>
            <p className="mt-1 text-xl font-black">{config?.specialty ?? 'Papas incluidas'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
