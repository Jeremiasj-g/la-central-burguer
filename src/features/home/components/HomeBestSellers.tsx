'use client';

import Link from 'next/link';
import { ArrowUpRight, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useMemo } from 'react';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { useCategoryDiscounts } from '@/features/promociones/hooks/useCategoryDiscounts';
import { businessDate, discountForCategory, discountedPrice } from '@/features/promociones/utils/descuentos.utils';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { useBusinessClock } from '@/features/configuracion/hooks/useBusinessClock';
import { useBestSellers } from '../hooks/useBestSellers';
import { formatCurrency } from '@/shared/utils/format.utils';

interface HomeBestSellersProps {
  onSelectProduct: (productId: string) => void;
}

export function HomeBestSellers({ onSelectProduct }: HomeBestSellersProps) {
  const { productos, isLoading: loadingProducts, error: productsError } = useProductos({
    active: 'active',
    available: 'all',
  });
  const { ranking, isLoading: loadingRanking, error: rankingError } = useBestSellers();
  const { campaigns } = useCategoryDiscounts();
  const { config } = useBusinessConfig();
  const now = useBusinessClock();
  const today = businessDate(now, config?.timezone);

  const bestSellers = useMemo(() => {
    const byId = new Map(productos.map(product => [product.id, product]));
    return ranking.flatMap(({ productId }) => {
      const product = byId.get(productId);
      if (!product) return [];
      const discountPercent = discountForCategory(campaigns, product.categoryId, today);
      const price = discountPercent > 0 ? discountedPrice(product.currentPrice, discountPercent) : product.currentPrice;
      return [{ product, price }];
    });
  }, [productos, ranking, campaigns, today]);

  return (
    <section id="mas-vendidos" className="lcb-best-sellers brick-wall relative scroll-mt-[80px] border-y border-central-orange/15 px-4 py-14 text-central-cream sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="relative mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-tight tracking-[-.055em] text-central-cream">
            Más vendidos del mes
          </h2>
          <Link href="#menu" className="inline-flex items-center gap-1.5 text-sm font-medium text-central-orange transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none">
            Ver la carta <ArrowUpRight size={16} />
          </Link>
        </div>
        {loadingProducts || loadingRanking ? (
          <div className="grid gap-4 md:grid-cols-3" role="status" aria-label="Cargando los más vendidos">
            {[0, 1, 2].map(index => <div key={index} className="lcb-best-seller-skeleton h-[330px] rounded-[20px] bg-[#201e1c]" />)}
          </div>
        ) : productsError || rankingError ? (
          <p className="py-6 text-sm text-central-cream/70" role="alert">
            No pudimos consultar los más vendidos. Podés explorar todos los productos en la carta.
          </p>
        ) : bestSellers.length === 0 ? (
          <p className="py-6 text-sm text-central-cream/70">
            Todavía no hay ventas registradas este mes.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {bestSellers.map(({ product, price }, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelectProduct(product.id)}
                aria-label={product.available ? `Elegir ${product.name} para agregar al carrito` : `Ver detalles de ${product.name}, temporalmente no disponible`}
                className="lcb-best-seller-card group flex w-full flex-col overflow-hidden rounded-[20px] bg-[#201e1c] text-left shadow-dark transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-central-orange motion-reduce:transition-none"
              >
                <div className="relative h-[190px] w-full bg-[#171514] sm:h-[210px]">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} loading="lazy" alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-central-orange/70">
                      <UtensilsCrossed size={38} strokeWidth={1.4} />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full border border-central-orange/30 bg-black/80 px-3 py-1.5 text-[11px] font-medium text-central-cream backdrop-blur-sm">
                    {index + 1}° más vendido
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-lg font-semibold leading-tight text-central-cream">{product.name}</h3>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-central-orange">{formatCurrency(price)}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-normal leading-6 text-central-cream/60">{product.description}</p>
                  {!product.available && <p className="mt-2 text-xs font-medium text-central-orange">No disponible por ahora</p>}
                  <p className="mt-auto inline-flex items-center gap-2 pt-5 text-xs font-medium text-central-cream/85">
                    <ShoppingBag size={15} />
                    {product.available ? 'Elegir y agregar al carrito' : 'Ver detalles'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
