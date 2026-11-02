'use client';

import Link from 'next/link';
import { ArrowUpRight, Beef, CupSoda, Pizza, Sandwich, UtensilsCrossed } from 'lucide-react';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { useProductos } from '@/features/productos/hooks/useProductos';

function categoryIcon(name: string) {
  const normalized = name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/hamburgues|burger|burguer/.test(normalized)) return <Beef size={23} strokeWidth={1.55} />;
  if (/pizza/.test(normalized)) return <Pizza size={23} strokeWidth={1.55} />;
  if (/lomito|sandwich|figazza/.test(normalized)) return <Sandwich size={23} strokeWidth={1.55} />;
  if (/bebida|gaseosa|cerveza/.test(normalized)) return <CupSoda size={23} strokeWidth={1.55} />;
  return <UtensilsCrossed size={23} strokeWidth={1.55} />;
}
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function HomeDiscovery() {
  const { categorias, isLoading: loadingCategories } = useCategorias({ active: 'active' });
  const { productos, isLoading: loadingProducts } = useProductos({ active: 'active', available: 'available' });
  const favorites = productos.filter(product => product.featured).slice(0, 3);
  const featured = favorites.length ? favorites : productos.slice(0, 3);

  return (
    <div className="bg-[#101012] text-[#f5f5f7]">
      <section id="especialidades" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[.2em] text-[#ff9a4c]">Para empezar</p>
            <h2 className="mt-3 text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-.055em]">Algo para cada antojo.</h2>
            <p className="mt-3 max-w-xl text-sm font-normal leading-6 text-white/55">Explorá la variedad de nuestra carta y encontrá lo que te gusta.</p>
          </div>
          <Link href="#menu" className="inline-flex items-center gap-1 text-sm font-medium text-[#ffac70] transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">Ver todo el menú <ArrowUpRight size={16} /></Link>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {loadingCategories ? Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-32 animate-none rounded-[22px] border border-white/10 bg-white/[.035]" />
          )) : categorias.slice(0, 6).map(category => (
            <Link href="#menu" key={category.id} className="group flex min-h-[128px] flex-col justify-between gap-7 rounded-[22px] border border-white/10 bg-[#1a1a1d] p-5 transition-transform duration-200 hover:scale-[1.025] focus-visible:outline-2 focus-visible:outline-[#ff933d] motion-reduce:transition-none">
              <span className="text-[#ff983f]">{categoryIcon(category.name)}</span>
              <span className="flex items-end justify-between gap-1 text-[13px] font-medium leading-5 text-white/85">
                {category.name}<ArrowUpRight size={15} className="shrink-0 text-white/35 group-hover:text-[#ff983f]" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {(loadingProducts || featured.length > 0) ? (
        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
          <div className="mb-7">
            <p className="text-xs font-medium uppercase tracking-[.2em] text-[#ff9a4c]">Selección de la casa</p>
            <h2 className="mt-3 text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-.055em]">Nuestros favoritos.</h2>
            <p className="mt-3 text-sm font-normal text-white/55">Productos del catálogo, con sus precios actualizados.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {loadingProducts ? Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-[340px] rounded-[24px] border border-white/10 bg-[#1a1a1d]" />
            )) : featured.map(product => (
              <Link key={product.id} href="#menu" className="group flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#1a1a1d] transition-transform duration-300 hover:scale-[1.015] focus-visible:outline-2 focus-visible:outline-[#ff933d] motion-reduce:transition-none">
                <div className="relative h-[185px] bg-[#292428] sm:h-[220px]">
                  {product.imageUrl ? <img src={product.imageUrl} loading="lazy" alt={product.name} className="h-full w-full object-cover" /> :
                    <div className="grid h-full place-items-center text-[#ff983f]"><UtensilsCrossed size={40} strokeWidth={1.3} /></div>}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-[-.025em] text-white">{product.name}</h3>
                    <span className="shrink-0 text-sm font-semibold text-[#ffab6f]">{money.format(product.currentPrice)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-normal leading-6 text-white/55">{product.description}</p>
                  <p className="mt-auto flex items-center gap-1 pt-5 text-xs font-medium text-white/80">Explorar en el menú <ArrowUpRight size={15} /></p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] border border-[#ff9d5b]/20 bg-[linear-gradient(110deg,#271b16,#4a291a_65%,#633015)] px-7 py-8 sm:flex-row sm:items-center sm:px-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[.18em] text-[#ffb67b]">¿Ya elegiste?</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white sm:text-3xl">Tu próxima favorita está en la carta.</h2>
          </div>
          <Link href="#menu" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#171412] transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">Hacer mi pedido <ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </div>
  );
}
