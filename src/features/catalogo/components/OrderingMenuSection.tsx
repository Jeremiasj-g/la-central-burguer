'use client';

import { ShoppingBag } from 'lucide-react';
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
  const businessName = config?.businessName?.trim() || 'La Central Burger';

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
  const activeTitle = selectedCategoryId === 'all' ? 'Menú completo' : categoryById[selectedCategoryId];

  return (
    <section id="menu" className="lcb-polished-menu relative scroll-mt-[78px] px-4 py-10 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
      <div className="pointer-events-none absolute inset-0 hidden overflow-x-clip">
        <div className="absolute left-6 top-8 hidden max-w-[280px] text-[70px] watermark-text opacity-90 lg:block">{businessName}</div>
        <div className="absolute right-[-60px] top-20 hidden h-72 w-72 rounded-full border-[18px] border-central-cream/5 lg:block" />
      </div>

      <div className="relative mx-auto w-full max-w-[1480px]">
        <div className="lcb-polished-menu-heading mb-7 text-center sm:mb-9">
          <div className="lcb-polished-menu-icon mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[15px] sm:mb-5 sm:h-14 sm:w-14">
            <ShoppingBag size={23} strokeWidth={1.7} />
          </div>
          <p className="lcb-polished-eyebrow text-[11px] font-semibold uppercase tracking-[.19em]">{businessName}</p>
          <h2 className="lcb-polished-title mt-2 text-4xl font-semibold tracking-[-.055em] sm:mt-3 sm:text-6xl">{activeTitle}</h2>
          <div className="lcb-polished-accent-line mx-auto mt-4" />
        </div>

        <div className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_370px] xl:gap-6">
          <div className="min-w-0">
            <div className="lcb-polished-menu-tools menu-ordering-tools sticky top-[76px] z-30 rounded-[18px] p-3 sm:p-4 lg:top-[85px]">
              <MenuSearchBar value={search} onChange={setSearch} />
              <div className="">
                {loadingCategories ? (
                  <div className="skeleton-dark h-[100px] rounded-[13px] bg-black/15 sm:h-[116px]" />
                ) : (
                  <CategoryTabs categories={categorias} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />
                )}
              </div>
            </div>

            <div className="mt-6 rounded-[18px] p-0 sm:mt-7">
              <div className="lcb-polished-list-heading mb-5 flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="lcb-polished-eyebrow text-[10px] font-semibold uppercase tracking-[.14em]">Elegí y agregá al pedido</p>
                  <h3 className="lcb-polished-subtitle mt-2 text-[24px] font-semibold leading-tight tracking-[-.045em] sm:text-[28px]">{activeTitle}</h3>
                </div>
              </div>

              {categoriesError || productsError ? (
                <div className="rounded-sm border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">
                  {productsError ?? categoriesError}
                </div>
              ) : (
                <>
                  <div className="grid min-w-0 gap-3.5 sm:gap-4 xl:grid-cols-2">
                    {loadingProducts ? Array.from({ length: 8 }).map((_, index) => <ProductoCardSkeleton key={index} />) : null}
                    {!loadingProducts && productos.map((product) => (
                      <ProductoCard key={product.id} product={product} categoryName={categoryById[product.categoryId]} disabled={!isBusinessOpen} onSelect={setSelectedProduct} onPreviewImage={setPreviewProduct} />
                    ))}
                  </div>
                  {!loadingProducts && productos.length === 0 ? <EmptyState className="lcb-polished-empty mt-6" title="No encontramos productos" description="Probá cambiar el texto de búsqueda o elegir otra categoría." /> : null}
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
