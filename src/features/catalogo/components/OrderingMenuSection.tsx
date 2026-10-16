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
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { isBusinessOpenBySchedule } from '@/features/configuracion/utils/businessStatus.utils';
import { formatMenuLabel } from '../utils/menuLabel';

export function OrderingMenuSection() {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  const { categorias, isLoading: loadingCategories, error: categoriesError } = useCategorias({ active: 'active' });
  const { productos, isLoading: loadingProducts, error: productsError, refresh: refreshProducts } = useProductos({
    search,
    categoryId: selectedCategoryId,
    available: 'all',
    active: 'active',
  });
  const cart = useCarrito();
  const { config } = useBusinessConfig();
  const isBusinessOpen = config ? isBusinessOpenBySchedule(config) : false;

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
            <div className="menu-ordering-tools sticky top-[72px] z-30 rounded-[16px] p-1 lg:py-6">
              <MenuSearchBar value={search} onChange={setSearch} />
              <div className="">
                {loadingCategories ? (
                  <div className="lcb-category-skeleton skeleton-dark h-[92px] rounded-[14px] bg-black/35 sm:h-28" />
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
                  <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
                    {loadingProducts ? Array.from({ length: 8 }).map((_, index) => <ProductoCardSkeleton key={index} />) : null}
                    {!loadingProducts && productos.map((product) => (
                      <ProductoCard key={product.id} product={product} categoryName={categoryById[product.categoryId]} disabled={!isBusinessOpen} onSelect={setSelectedProduct} onPreviewImage={setPreviewProduct} />
                    ))}
                  </div>
                  {!loadingProducts && productos.length === 0 ? <EmptyState className="mt-6 border-central-orange/25 bg-black/30 text-central-cream" title="No encontramos productos" description="Probá cambiar el texto de búsqueda o elegir otra categoría." /> : null}
                </>
              )}
            </div>
          </div>

          <CartSidebar items={cart.items} total={cart.totals.total} checkoutDisabled={!isBusinessOpen} onUpdateQuantity={cart.updateQuantity} onUpdateNote={cart.updateNote} onRemove={cart.removeItem} onClear={cart.clear} onCheckout={() => isBusinessOpen && setCheckoutOpen(true)} />
        </div>
      </div>

      <ProductDetailModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        disabled={!isBusinessOpen || !selectedProduct?.available}
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
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart.items} total={cart.totals.total} checkoutDisabled={!isBusinessOpen} onUpdateQuantity={cart.updateQuantity} onUpdateNote={cart.updateNote} onRemove={cart.removeItem} onClear={cart.clear} onCheckout={() => isBusinessOpen && setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} items={cart.items} onOrderCreated={() => setCartOpen(false)} />
    </section>
  );
}
