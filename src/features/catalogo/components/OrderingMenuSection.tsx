'use client';

import { ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { CartFloatingButton } from './CartFloatingButton';
import { CheckoutModal } from '@/features/checkout/components/CheckoutModal';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { isBusinessOpenBySchedule } from '@/features/configuracion/utils/businessStatus.utils';

export function OrderingMenuSection() {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  const { categorias, isLoading: loadingCategories, error: categoriesError } = useCategorias({ active: 'active' });
  const { productos, isLoading: loadingProducts, error: productsError } = useProductos({
    search,
    categoryId: selectedCategoryId,
    available: 'all',
    active: 'active',
  });
  const cart = useCarrito();
  const { config } = useBusinessConfig();
  const isBusinessOpen = config ? isBusinessOpenBySchedule(config) : false;
  const businessName = config?.businessName?.trim() || 'La Central Burger';

  const categoryById = useMemo(() => Object.fromEntries(categorias.map((category) => [category.id, category.name])), [categorias]);
  const activeTitle = selectedCategoryId === 'all' ? 'Menú completo' : categoryById[selectedCategoryId];
  const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section id="menu" className="brick-wall relative px-5 py-7 text-central-cream sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-x-clip">
        <div className="absolute left-6 top-8 hidden max-w-[280px] text-[70px] watermark-text opacity-90 lg:block">{businessName}</div>
        <div className="absolute right-[-60px] top-20 hidden h-72 w-72 rounded-full border-[18px] border-central-cream/5 lg:block" />
      </div>

      <div className="relative w-full">
        <div className="mb-5 text-center sm:mb-7">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border-2 border-central-cream/80 bg-central-cream text-central-carbon shadow-dark sm:mb-4 sm:h-20 sm:w-20">
            <ShoppingBag size={30} />
          </div>
          <p className="font-black uppercase tracking-[.35em] text-central-orange sm:tracking-[.45em]">{businessName}</p>
          <h2 className="menu-title-shadow mt-2 font-display text-3xl sm:mt-3 sm:text-7xl uppercase tracking-wide text-central-cream">{activeTitle}</h2>
          <div className="brush-line mx-auto mt-4" />
        </div>

        <div className="relative min-h-[calc(100dvh-72px)] lg:grid lg:min-h-[calc(100dvh+420px)] lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <div className="menu-ordering-tools sticky top-[72px] z-30 rounded-sm border border-central-orange/20 bg-[#0d0c0b]/96 p-3 shadow-dark backdrop-blur-xl sm:p-4 lg:px-4">
              <MenuSearchBar value={search} onChange={setSearch} />
              <div className="mt-3 sm:mt-4">
                {loadingCategories ? (
                  <div className="skeleton-dark h-[92px] rounded-sm border border-central-orange/20 bg-black/35 sm:h-28" />
                ) : (
                  <CategoryTabs categories={categorias} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />
                )}
              </div>
            </div>

            <div className="mt-4 rounded-sm border border-central-orange/25 bg-black/28 p-3.5 shadow-dark backdrop-blur sm:mt-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 border-b border-dashed border-central-orange/40 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.32em] text-central-orange">Elegí y agregá al pedido</p>
                  <h3 className="mt-1.5 font-display text-3xl sm:mt-2 sm:text-4xl uppercase leading-none tracking-wide text-central-cream">{activeTitle}</h3>
                </div>
              </div>

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

          <CartSidebar items={cart.items} total={cart.totals.total} checkoutDisabled={!isBusinessOpen} onUpdateQuantity={cart.updateQuantity} onUpdateNote={cart.updateNote} onRemove={cart.removeItem} onCheckout={() => isBusinessOpen && setCheckoutOpen(true)} />
        </div>
      </div>

      <ProductDetailModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        disabled={!isBusinessOpen}
        onClose={() => setSelectedProduct(null)}
        onPreviewImage={setPreviewProduct}
        categoryName={selectedProduct ? categoryById[selectedProduct.categoryId] : undefined}
        onAddToCart={({ product, quantity, note }) => {
          if (!isBusinessOpen) return;
          cart.addItem({
            productId: product.id,
            productName: product.name,
            imageUrl: product.imageUrl,
            categoryName: categoryById[product.categoryId],
            unitPrice: product.currentPrice,
            quantity,
            note,
          });
        }}
      />
      <ProductImageLightbox
        open={Boolean(previewProduct)}
        imageUrl={previewProduct?.imageUrl ?? ''}
        productName={previewProduct?.name ?? 'Imagen del producto'}
        categoryName={previewProduct ? categoryById[previewProduct.categoryId] : undefined}
        onClose={() => setPreviewProduct(null)}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart.items} total={cart.totals.total} checkoutDisabled={!isBusinessOpen} onUpdateQuantity={cart.updateQuantity} onUpdateNote={cart.updateNote} onRemove={cart.removeItem} onCheckout={() => isBusinessOpen && setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} items={cart.items} onOrderCreated={() => setCartOpen(false)} />
      <CartFloatingButton count={cartCount} total={cart.totals.total} onClick={() => setCartOpen(true)} />
    </section>
  );
}
