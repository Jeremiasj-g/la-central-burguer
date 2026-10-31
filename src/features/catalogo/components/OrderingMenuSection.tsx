'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { useProductos } from '@/features/productos/hooks/useProductos';
import type { Product } from '@/features/productos/types/producto.types';
import { useCarrito } from '@/features/carrito/hooks/useCarrito';
import { CategoryTabs } from './CategoryTabs';
import { MenuSearchBar } from './MenuSearchBar';
import { ProductoCard } from '@/features/productos/components/ProductoCard';
import { ProductoCardSkeleton } from '@/features/productos/components/ProductoCardSkeleton';
import { ProductDetailModal } from '@/features/productos/components/ProductDetailModal';
import { ProductImageLightbox } from '@/features/productos/components/ProductImageLightbox';
import { CartSidebar } from '@/features/carrito/components/CartSidebar';
import { CartDrawer } from '@/features/carrito/components/CartDrawer';
import { CheckoutModal } from '@/features/checkout/components/CheckoutModal';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { toast } from 'react-toastify';
import { getOrderableProductIds } from '@/features/productos/services/productos.service';
import { useCategoryDiscounts } from '@/features/promociones/hooks/useCategoryDiscounts';
import { businessDate, discountForCategory, discountedPrice } from '@/features/promociones/utils/descuentos.utils';
import { calculateCartTotals } from '@/features/carrito/services/carrito.service';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { isBusinessOpenBySchedule } from '@/features/configuracion/utils/businessStatus.utils';
import { useBusinessClock } from '@/features/configuracion/hooks/useBusinessClock';
import { formatMenuLabel } from '../utils/menuLabel';

const CATEGORY_SWITCH_MS = 220;

export function OrderingMenuSection() {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [displayedCategoryId, setDisplayedCategoryId] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  const { categorias, isLoading: loadingCategories, error: categoriesError } = useCategorias({ active: 'active' });
  const { productos: catalogProducts, isLoading: loadingProducts, error: productsError, refresh: refreshProducts } = useProductos({
    available: 'all', active: 'active',
  });
  const { campaigns } = useCategoryDiscounts();

  // El catálogo ya está en memoria. Mostramos una transición breve al elegir
  // una categoría, sin volver a pedir los productos a Supabase.
  const switchingCategory = selectedCategoryId !== displayedCategoryId;
  useEffect(() => {
    if (!switchingCategory) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayedCategoryId(selectedCategoryId);
      return;
    }
    const timeout = window.setTimeout(() => setDisplayedCategoryId(selectedCategoryId), CATEGORY_SWITCH_MS);
    return () => window.clearTimeout(timeout);
  }, [selectedCategoryId, switchingCategory]);
  const cart = useCarrito();
  const { config } = useBusinessConfig();
  const now = useBusinessClock();
  const today = businessDate(now, config?.timezone);
  const isBusinessOpen = config ? isBusinessOpenBySchedule(config,now) : false;
  // Descuentos solo para el menú público: los precios originales del catálogo administrativo no cambian.
  const pricedProducts = useMemo(() => catalogProducts.map(product => {
    const discountPercent = discountForCategory(campaigns, product.categoryId, today);
    return discountPercent > 0
      ? { ...product, originalPrice: product.currentPrice, discountPercent,
          currentPrice: discountedPrice(product.currentPrice, discountPercent) }
      : product;
  }), [catalogProducts, campaigns, today]);
  const productos = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return pricedProducts.filter(product =>
      (displayedCategoryId === 'all' || product.categoryId === displayedCategoryId)
      && (!query || product.name.toLocaleLowerCase('es').includes(query)
        || product.description.toLocaleLowerCase('es').includes(query)));
  }, [pricedProducts, displayedCategoryId, search]);
  // Revalidamos visualmente los precios del carrito cuando comienza/termina una campaña.
  // El servidor siempre vuelve a calcular los precios al confirmar.
  const pricedCartItems = useMemo(() => {
    const byId = new Map(pricedProducts.map(p => [p.id, {
      unitPrice: p.currentPrice,
      originalUnitPrice: p.originalPrice ?? p.currentPrice,
      discountPercent: p.discountPercent ?? 0,
    }]));
    return cart.items.map(item => ({ ...item, ...(byId.get(item.productId) ?? {}) }));
  }, [cart.items, pricedProducts]);
  const pricedCartTotals = useMemo(() => calculateCartTotals(pricedCartItems), [pricedCartItems]);
  const selectedProductLive = selectedProduct
    ? pricedProducts.find(product => product.id === selectedProduct.id) ?? selectedProduct
    : null;

  useEffect(() => {
    function handleCartOpen() {
      setCartOpen(true);
    }

    window.addEventListener('central-cart-open', handleCartOpen);
    return () => window.removeEventListener('central-cart-open', handleCartOpen);
  }, []);

  useEffect(() => {
    if (!loadingProducts && selectedProduct && !productos.some((item) => item.id === selectedProduct.id && item.available)) {
      setSelectedProduct(null);
    }
  }, [loadingProducts, productos, selectedProduct]);

  const categoryById = useMemo(() => Object.fromEntries(categorias.map((category) => [category.id, category.name])), [categorias]);
  const activeTitle = selectedCategoryId === 'all' ? 'Menú completo' : (categoryById[selectedCategoryId] ?? 'Menú');
  const showingSkeleton = loadingProducts || switchingCategory;
  const skeletonCount = loadingProducts ? 8 : Math.min(6, Math.max(2,
    pricedProducts.filter(product => selectedCategoryId === 'all' || product.categoryId === selectedCategoryId).length,
  ));

  return (
    <section id="menu" className="brick-wall lcb-ordering-section relative px-5 py-9 text-central-cream sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <div className="relative mx-auto w-full max-w-[1480px]">
        <div className="mb-6 text-center sm:mb-9">
          <h2 className="mx-auto max-w-[95%] break-words text-[clamp(3.1rem,9vw,6.4rem)] font-semibold leading-[1.06] tracking-[-.055em] text-central-cream" aria-live="polite">
            {formatMenuLabel(activeTitle)}
          </h2>
          <div className="mx-auto mt-5 h-[3px] w-14 rounded-full bg-central-orange sm:mt-6" aria-hidden="true" />
        </div>

        <div className="relative min-h-[calc(100dvh-72px)] lg:grid lg:min-h-[calc(100dvh+420px)] lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <div className="menu-ordering-tools sticky top-[72px] z-30 rounded-[16px] px-1 py-0 lg:top-[92px]">
              <MenuSearchBar value={search} onChange={setSearch} />
              <div className="">
                {loadingCategories ? (
                  <div className="lcb-category-skeleton skeleton-dark h-[78px] rounded-[14px] bg-black/35 sm:h-28" />
                ) : (
                  <CategoryTabs categories={categorias} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[16px] p-1 backdrop-blur sm:mt-5">
              {categoriesError || productsError ? (
                <div className="rounded-sm border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">
                  {productsError ?? categoriesError}
                </div>
              ) : (
                <>
                  <div
                    key={showingSkeleton ? 'menu-loading' : `menu-${displayedCategoryId}`}
                    className={`grid gap-3 sm:gap-4 xl:grid-cols-2 ${showingSkeleton ? '' : 'lcb-menu-products-enter'}`}
                    aria-busy={showingSkeleton}
                  >
                    {showingSkeleton
                      ? Array.from({ length: skeletonCount }, (_, index) => <ProductoCardSkeleton key={index} />)
                      : productos.map((product) => (
                          <ProductoCard key={product.id} product={product} categoryName={categoryById[product.categoryId]} disabled={!isBusinessOpen} onSelect={setSelectedProduct} onPreviewImage={setPreviewProduct} />
                        ))}
                  </div>
                  {!showingSkeleton && productos.length === 0 ? <EmptyState className="mt-6 border-central-orange/25 bg-black/30 text-central-cream" title="No encontramos productos" description="Probá cambiar el texto de búsqueda o elegir otra categoría." /> : null}
                </>
              )}
            </div>
          </div>

          <CartSidebar items={pricedCartItems} total={pricedCartTotals.total} checkoutDisabled={!isBusinessOpen} onUpdateQuantity={cart.updateQuantity} onUpdateNote={cart.updateNote} onRemove={cart.removeItem} onClear={cart.clear} onCheckout={() => isBusinessOpen && setCheckoutOpen(true)} />
        </div>
      </div>

      <ProductDetailModal
        product={selectedProductLive}
        open={Boolean(selectedProduct)}
        disabled={!isBusinessOpen || !selectedProductLive?.available}
        onClose={() => setSelectedProduct(null)}
        onPreviewImage={setPreviewProduct}
        categoryName={selectedProduct ? categoryById[selectedProduct.categoryId] : undefined}
        onAddToCart={async ({ product, quantity, note }) => {
          if (!isBusinessOpen || !product.available) return false;
          try {
            const orderableIds = await getOrderableProductIds([product.id]);
            if (!orderableIds.has(product.id)) {
              toast.warning('Este producto ya no está disponible.');
              void refreshProducts();
              return false;
            }
            cart.addItem({
              productId: product.id,
              productName: product.name,
              imageUrl: product.imageUrl,
              categoryName: categoryById[product.categoryId],
              unitPrice: product.currentPrice,
              originalUnitPrice: product.originalPrice ?? product.currentPrice,
              discountPercent: product.discountPercent ?? 0,
              quantity,
              note,
            });
            return true;
          } catch {
            toast.error('No pudimos verificar la disponibilidad. Intentá nuevamente.');
            return false;
          }
        }}
      />
      <ProductImageLightbox
        open={Boolean(previewProduct)}
        imageUrl={previewProduct?.imageUrl ?? ''}
        productName={previewProduct?.name ?? 'Imagen del producto'}
        categoryName={previewProduct ? categoryById[previewProduct.categoryId] : undefined}
        onClose={() => setPreviewProduct(null)}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={pricedCartItems} total={pricedCartTotals.total} checkoutDisabled={!isBusinessOpen} onUpdateQuantity={cart.updateQuantity} onUpdateNote={cart.updateNote} onRemove={cart.removeItem} onClear={cart.clear} onCheckout={() => isBusinessOpen && setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} items={pricedCartItems} onOrderCreated={() => setCartOpen(false)} />
    </section>
  );
}
