'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowDownRight, Clock3, MapPin, ShoppingBag } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { isBusinessOpenBySchedule, getWeeklyBusinessHours } from '@/features/configuracion/utils/businessStatus.utils';
import { useBusinessClock } from '@/features/configuracion/hooks/useBusinessClock';

export function BurgerHero() {
  const { config, isLoading } = useBusinessConfig();
  const now = useBusinessClock();
  const isOpen = config ? isBusinessOpenBySchedule(config, now) : false;
  const maintenance = Boolean(config?.maintenanceMode);
  const hours = config ? getWeeklyBusinessHours(config) : [];

  return (
    <section id="inicio" className="relative isolate overflow-hidden bg-[#0d0d0f] text-[#f5f5f7]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_30%,rgba(255,128,37,.17),transparent_45%),linear-gradient(145deg,#0d0d0f,#171518_64%,#0d0d0f)]" />
      <div className="relative mx-auto grid min-h-[600px] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-12 lg:py-24">
        <div className="min-w-0">
          <p className="mb-5 text-xs font-medium uppercase tracking-[.2em] text-[#ff9a4c]">
            Chetos · Corrientes
          </p>
          <h1 className="max-w-[700px] text-[clamp(3.1rem,7.6vw,6.7rem)] font-semibold leading-[.99] tracking-[-.075em]">
            Comida que <span className="text-[#ff933d]">se disfruta</span> de verdad.
          </h1>
          <p className="mt-6 max-w-xl text-base font-normal leading-7 text-white/65 sm:text-lg">
            Hamburguesas, lomitos, pizzas y mucho más. Elegí tu favorito, armá tu pedido y disfrutá.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="#menu"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#ff8730] px-6 text-sm font-semibold text-[#151311] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff8730] motion-reduce:transition-none"
            >
              Ver nuestra carta <ArrowDownRight size={17} strokeWidth={1.8} />
            </Link>
            <Link
              href="#especialidades"
              className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-medium text-white transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none"
            >
              Descubrí los favoritos
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm font-normal text-white/65">
            <span className="inline-flex items-center gap-2">
              <span className={'h-2 w-2 rounded-full ' + (maintenance ? 'bg-amber-400' : isOpen ? 'bg-emerald-400' : 'bg-white/40')} />
              {isLoading ? 'Consultando horarios' : maintenance ? 'En mantenimiento' : isOpen ? 'Abierto ahora' : 'Cerrado ahora'}
            </span>
            <span className="inline-flex items-center gap-2"><ShoppingBag size={16} strokeWidth={1.7} /> Pedidos online</span>
            <span className="inline-flex min-w-0 items-center gap-2"><MapPin size={16} strokeWidth={1.7} /> {config?.address?.trim() || 'Corrientes, Argentina'}</span>
          </div>
          {hours.length > 0 ? (
            <details className="mt-4 max-w-md text-xs font-normal text-white/55">
              <summary className="inline-flex cursor-pointer items-center gap-2 text-white/65"><Clock3 size={14} /> Ver horarios</summary>
              <div className="mt-3 grid gap-1.5 border-l border-white/15 pl-3">
                {hours.map(row => <div key={row.label} className="flex justify-between gap-6"><span>{row.label}</span><span>{row.hours}</span></div>)}
              </div>
            </details>
          ) : null}
        </div>
        <div className="relative flex min-h-[280px] items-center justify-center sm:min-h-[400px] lg:min-h-[460px]">
          <div aria-hidden="true" className="pointer-events-none absolute h-[75%] w-[75%] max-w-[410px] rounded-full bg-[#ff842b]/15 blur-[75px]" />
          <div className="relative mx-auto grid aspect-square w-full max-w-[470px] place-items-center rounded-full border border-[#ff9c52]/10 bg-[radial-gradient(circle_at_50%_48%,#352014_0%,#1b1717_56%,#101012_80%)]">
            <Image
              src="/branding/chef-cutout.webp"
              width={540}
              height={400}
              alt="Chef de Chetos sosteniendo una pizza y una hamburguesa"
              priority
              className="relative h-auto w-[91%] max-w-[420px] object-contain drop-shadow-[0_22px_35px_rgba(0,0,0,.32)]"
            />
          </div>
          <span className="absolute bottom-3 right-1 rounded-full border border-white/15 bg-[#201c1b] px-4 py-2 text-xs font-medium text-white/80 sm:bottom-10 sm:right-5">
            Una obra maestra
          </span>
        </div>
      </div>
    </section>
  );
}
