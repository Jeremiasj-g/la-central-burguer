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

interface OrderingMenuSectionProps {
  requestedProductId?: string | null;
  onRequestHandled?: () => void;
}

export function OrderingMenuSection({
  requestedProductId = null,
  onRequestHandled,
}: OrderingMenuSectionProps = {}) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  const { categorias, isLoading: loadingCategories, error: categoriesError } = useCategorias({ active: 'active' });
  const { productos: catalogProducts, isLoading: loadingProducts, error: productsError, refresh: refreshProducts } = useProductos({
    available: 'all', active: 'active',
  });
  const { campaigns } = useCategoryDiscounts();

  // El cambio de categoría es inmediato: sin animaciones de entrada ni esperas artificiales.
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
      (selectedCategoryId === 'all' || product.categoryId === selectedCategoryId)
      && (!query || product.name.toLocaleLowerCase('es').includes(query)
        || product.description.toLocaleLowerCase('es').includes(query)));
  }, [pricedProducts, selectedCategoryId, search]);
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

  // Las tarjetas de Más vendidos abren el mismo modal y conservan la
  // verificación de precios, horarios y disponibilidad de la carta.
  useEffect(() => {
    if (!requestedProductId || loadingProducts) return;
    const product = pricedProducts.find(item => item.id === requestedProductId);
    if (product) {
      setSelectedProduct(product);
    } else {
      toast.warning('Este producto ya no se encuentra en la carta.');
    }
    onRequestHandled?.();
  }, [requestedProductId, loadingProducts, pricedProducts, onRequestHandled]);

  // Un detalle abierto desde Más vendidos no debe cerrarse por el filtro de
  // búsqueda/categoría de la carta, ni por estar temporalmente agotado.
  useEffect(() => {
    if (!loadingProducts && selectedProduct && !pricedProducts.some(item => item.id === selectedProduct.id)) {
      setSelectedProduct(null);
    }
  }, [loadingProducts, pricedProducts, selectedProduct]);

  const categoryById = useMemo(() => Object.fromEntries(categorias.map((category) => [category.id, category.name])), [categorias]);
  const activeTitle = selectedCategoryId === 'all' ? 'Menú completo' : (categoryById[selectedCategoryId] ?? 'Menú');
  const showingSkeleton = loadingProducts;
  const skeletonCount = loadingProducts ? 8 : Math.min(6, Math.max(2,
    pricedProducts.filter(product => selectedCategoryId === 'all' || product.categoryId === selectedCategoryId).length,
  ));

  return (
    <section id="menu" className="chet-ordering-section relative scroll-mt-[70px] bg-[#141416] px-5 pb-16 pt-16 text-white sm:px-8 sm:pb-20 sm:pt-20">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-9 flex flex-col justify-between gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end">
          <div className="min-w-0">
            <h2 className="mt-3 text-[clamp(2.2rem,5vw,3.7rem)] font-semibold leading-[1.05] tracking-[-.06em] text-white">
              Elegí lo que más te guste.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-normal leading-6 text-white/55">
              Explorá el menú, personalizá tu elección y armá tu pedido.
            </p>
          </div>
          <p className="text-[13px] font-normal text-white/50" aria-live="polite">
            {loadingProducts ? 'Cargando la carta...' : productos.length === 1 ? '1 producto' : productos.length + ' productos'}
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start lg:gap-9 xl:grid-cols-[minmax(0,1fr)_355px]">
          <div className="min-w-0">
            <div className="menu-ordering-tools sticky top-[70px] z-50 -mx-2 border-b border-white/10 bg-[#141416] px-2 pb-3 pt-3 lg:top-[70px]">
              <MenuSearchBar value={search} onChange={setSearch} />
              <div className="mt-2">
                {loadingCategories ? (
                  <div className="h-11 rounded-full bg-white/[.045]" aria-label="Cargando categorías" />
                ) : (
                  <CategoryTabs categories={categorias} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />
                )}
              </div>
            </div>

            <div className="mt-7">
              {selectedCategoryId !== 'all' ? (
                <h3 className="mb-5 text-xl font-semibold tracking-[-.035em] text-white" aria-live="polite">
                  {formatMenuLabel(activeTitle)}
                </h3>
              ) : null}
              {categoriesError || productsError ? (
                <div role="alert" className="rounded-[18px] border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">
                  {productsError ?? categoriesError}
                </div>
              ) : (
                <>
                  <div className="relative z-0 isolate grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy={showingSkeleton}>
                    {showingSkeleton
                      ? Array.from({ length: skeletonCount }, (_, index) => <ProductoCardSkeleton key={index} />)
                      : productos.map(product => (
                        <ProductoCard key={product.id} product={product} categoryName={categoryById[product.categoryId]} disabled={!isBusinessOpen} onSelect={setSelectedProduct} onPreviewImage={setPreviewProduct} />
                      ))}
                  </div>
                  {!showingSkeleton && productos.length === 0 ? (
                    <EmptyState className="mt-6 border-white/10 bg-white/[.025] text-white" title="No encontramos productos" description="Probá otra búsqueda o elegí una categoría diferente." />
                  ) : null}
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
