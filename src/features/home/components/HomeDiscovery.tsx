'use client';

import Link from 'next/link';
import { ArrowUpRight, UtensilsCrossed } from 'lucide-react';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { useBestSellers } from '../hooks/useBestSellers';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function HomeDiscovery() {
  const { productos, isLoading: loadingProducts, error: productsError } = useProductos({
    active: 'active',
    available: 'all',
  });
  const { ranking, isLoading: loadingRanking, error: rankingError } = useBestSellers();
  const byId = new Map(productos.map(product => [product.id, product]));
  const bestSellers = ranking
    .map(rank => ({ product: byId.get(rank.productId), unitsSold: rank.unitsSold }))
    .filter((entry): entry is { product: (typeof productos)[number]; unitsSold: number } => Boolean(entry.product));
  const isLoading = loadingProducts || loadingRanking;

  return (
    <section id="mas-vendidos" className="chet-discovery scroll-mt-[70px] bg-[#101012] px-5 py-16 text-[#f5f5f7] sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-.055em]">Más vendidos del mes</h2>
          <Link href="#menu" className="inline-flex items-center gap-1 text-sm font-medium text-[#ffac70] transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">
            Ver la carta <ArrowUpRight size={16} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3" role="status" aria-label="Cargando más vendidos">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-[340px] rounded-[24px] border border-white/10 bg-[#1a1a1d]" />)}
          </div>
        ) : productsError || rankingError ? (
          <p role="alert" className="py-6 text-sm font-normal text-white/60">
            No pudimos cargar el ranking de ventas. Podés explorar todos los productos en la carta.
          </p>
        ) : bestSellers.length === 0 ? (
          <p className="py-6 text-sm font-normal text-white/60">
            Todavía no hay ventas registradas este mes.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {bestSellers.map(({ product, unitsSold }, index) => (
              <Link key={product.id} href="#menu" className="group flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#1a1a1d] transition-transform duration-300 hover:scale-[1.015] focus-visible:outline-2 focus-visible:outline-[#ff933d] motion-reduce:transition-none">
                <div className="relative h-[185px] bg-[#292428] sm:h-[220px]">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} loading="lazy" alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-[#ff983f]"><UtensilsCrossed size={40} strokeWidth={1.3} /></div>
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-[#1c1c20]/85 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                    {index + 1}° más vendido
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-[-.025em] text-white">{product.name}</h3>
                    <span className="shrink-0 text-sm font-semibold text-[#ffab6f]">{money.format(product.currentPrice)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-normal leading-6 text-white/55">{product.description}</p>
                  <p className="mt-3 text-xs font-normal text-white/50">{unitsSold} {unitsSold === 1 ? 'unidad vendida' : 'unidades vendidas'}</p>
                  {!product.available && (
                    <p className="mt-2 text-xs font-medium text-[#ffac75]">No disponible por ahora</p>
                  )}
                  <p className="mt-auto flex items-center gap-1 pt-5 text-xs font-medium text-white/80">Ver en el menú <ArrowUpRight size={15} /></p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
