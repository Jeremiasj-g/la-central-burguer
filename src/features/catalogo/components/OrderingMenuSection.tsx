'use client';

import { ArrowDownRight, Sparkles, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { useProductos } from '@/features/productos/hooks/useProductos';
import type { Product } from '@/features/productos/types/producto.types';
import { useCarrito } from '@/features/carrito/hooks/useCarrito';
import { CategoryTabs } from './CategoryTabs';
import { MenuSearchBar } from './MenuSearchBar';
import { CartFloatingButton } from './CartFloatingButton';
import { ProductoCard } from '@/features/productos/components/ProductoCard';
import { ProductoCardSkeleton } from '@/features/productos/components/ProductoCardSkeleton';
import { ProductDetailModal } from '@/features/productos/components/ProductDetailModal';
import { ProductImageLightbox } from '@/features/productos/components/ProductImageLightbox';
import { CartSidebar } from '@/features/carrito/components/CartSidebar';
import { CartDrawer } from '@/features/carrito/components/CartDrawer';
import { CheckoutModal } from '@/features/checkout/components/CheckoutModal';
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

  const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section id="menu" className="lcb-menu-section scroll-mt-[74px]">
      <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-14 sm:px-7 sm:pt-20 lg:px-10 lg:pb-24">
        <div className="mb-8 grid items-end gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div>
            <p className="lcb-section-eyebrow"><Sparkles size={14} strokeWidth={1.8}/> Hecho para darte el gusto</p>
            <h2 className="lcb-menu-main-heading mt-4">El menú<span className="text-[var(--lcb-accent)]">.</span></h2>
            <p className="mt-3 max-w-[460px] text-[13px] leading-6 text-[var(--lcb-muted)] sm:text-[14px]">
              Encontrá tu favorito, elegí cómo lo querés y nosotros nos encargamos del resto.
            </p>
          </div>
          <div className="hidden items-center gap-3 pb-2 lg:flex">
            <span className="lcb-menu-meta-number">{!loadingProducts ? productos.length : '—'}</span>
            <div className="text-[11px] leading-4 text-[var(--lcb-muted)]">opciones para<br/>elegir</div>
            <ArrowDownRight className="ml-3 text-[var(--lcb-accent)]" size={24} strokeWidth={1.5}/>
          </div>
        </div>

        <div className="lcb-menu-tools relative z-30 mb-7">
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-center">
            <div className="min-w-0">
              {loadingCategories ? <div className="lcb-category-loading h-[48px] animate-pulse rounded-[13px]"/> : (
                <CategoryTabs categories={categorias} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId}/>
              )}
            </div>
            <MenuSearchBar value={search} onChange={setSearch}/>
          </div>
        </div>

        <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_310px] xl:gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-[var(--lcb-muted)]">Explorá la carta</p>
                <h3 className="mt-1 text-[21px] font-semibold leading-tight tracking-[-.04em] sm:text-[24px]">{activeTitle}</h3>
              </div>
              {!loadingProducts && (
                <span className="lcb-results-count">{productos.length} {productos.length === 1 ? 'producto' : 'productos'}</span>
              )}
            </div>
            {categoriesError || productsError ? (
              <div className="lcb-menu-error" role="alert">{productsError ?? categoriesError}</div>
            ) : (
              <>
                <div className="grid min-w-0 grid-cols-1 gap-4 min-[530px]:grid-cols-2 xl:grid-cols-3">
                  {loadingProducts ? Array.from({ length: 6 }).map((_, index) => <ProductoCardSkeleton key={index}/>) : null}
                  {!loadingProducts && productos.map(product => (
                    <ProductoCard key={product.id} product={product}
                      categoryName={categoryById[product.categoryId]}
                      disabled={!isBusinessOpen} onSelect={setSelectedProduct} onPreviewImage={setPreviewProduct}/>
                  ))}
                </div>
                {!loadingProducts && productos.length === 0 ? (
                  <div className="lcb-menu-empty mt-3 flex min-h-[200px] flex-col items-center justify-center px-5 text-center">
                    <ShoppingBag size={28} strokeWidth={1.5} className="text-[var(--lcb-accent)]"/>
                    <p className="mt-4 font-semibold">No encontramos productos</p>
                    <p className="mt-1 text-[12px] text-[var(--lcb-muted)]">Probá con otra categoría o cambiá tu búsqueda.</p>
                    <button type="button" className="lcb-clear-search mt-4" onClick={() => { setSearch(''); setSelectedCategoryId('all'); }}>
                      Ver todo el menú
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <CartSidebar items={cart.items} total={cart.totals.total}
            checkoutDisabled={!isBusinessOpen} onUpdateQuantity={cart.updateQuantity}
            onUpdateNote={cart.updateNote} onRemove={cart.removeItem} onClear={cart.clear}
            onCheckout={() => isBusinessOpen && setCheckoutOpen(true)}/>
        </div>
      </div>
      {cartCount > 0 && <CartFloatingButton count={cartCount} total={cart.totals.total} onClick={() => setCartOpen(true)} />}

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
