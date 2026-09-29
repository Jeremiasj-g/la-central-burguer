'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Edit3,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { TablePagination } from '@/shared/components/ui/TablePagination';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import { getProductos, subscribeToProducts } from '@/features/productos/services/productos.service';
import type { Product } from '@/features/productos/types/producto.types';
import { getCategorias, subscribeToCategories } from '@/features/categorias/services/categorias.service';
import type { Category } from '@/features/categorias/types/categoria.types';
import {
  cancelCounterSale,
  createCounterSale,
  getCounterSaleForEdit,
  getCounterSales,
  updateCounterSale,
  type CounterPaymentMethod,
  type CounterSaleListItem,
  type CounterServiceMode,
} from '../services/venta-mostrador.service';

type CartLine = {
  product: Product;
  quantity: number;
};

export function VentaMostradorPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serviceMode, setServiceMode] = useState<CounterServiceMode>('takeaway');
  const [paymentMethod, setPaymentMethod] = useState<CounterPaymentMethod>('efectivo');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lastSale, setLastSale] = useState<{ orderCode: string; total: number } | null>(null);
  const [editingSale, setEditingSale] = useState<{ id: string; orderCode: string } | null>(null);
  const [sales, setSales] = useState<CounterSaleListItem[]>([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesLoading, setSalesLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<CounterSaleListItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function loadProducts(background = false) {
    if (!background) setLoading(true);
    try {
      setProducts(await getProductos({ active: 'active', available: 'available' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      setCategories(await getCategorias({ active: 'active' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las categorías.');
    }
  }

  async function loadSales(targetPage = salesPage, background = false) {
    if (!background) setSalesLoading(true);
    try {
      const result = await getCounterSales({ page: targetPage, pageSize: 10 });
      setSales(result.rows);
      setSalesTotal(result.total);

      const maxPage = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (targetPage > maxPage) setSalesPage(maxPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las ventas de mostrador.');
    } finally {
      setSalesLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
    void loadCategories();
    void loadSales(1);

    const unsubscribeProducts = subscribeToProducts(() => void loadProducts(true));
    const unsubscribeCategories = subscribeToCategories(() => void loadCategories());

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, []);

  useEffect(() => {
    if (salesPage === 1) return;
    void loadSales(salesPage);
  }, [salesPage]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => products.some((product) => product.categoryId === category.id)),
    [categories, products],
  );

  useEffect(() => {
    if (
      selectedCategoryId !== 'all'
      && !visibleCategories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId('all');
    }
  }, [selectedCategoryId, visibleCategories]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');

    return products.filter((product) => {
      const matchesCategory = selectedCategoryId === 'all' || product.categoryId === selectedCategoryId;
      if (!matchesCategory) return false;
      if (!normalized) return true;

      return [product.name, product.description].some((value) =>
        value.toLocaleLowerCase('es').includes(normalized),
      );
    });
  }, [products, query, selectedCategoryId]);

  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + line.product.currentPrice * line.quantity, 0);

  function addProduct(product: Product) {
    setLastSale(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: Math.min(99, line.quantity + 1) }
            : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.max(0, Math.min(99, line.quantity + delta)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeProduct(productId: string) {
    setCart((current) => current.filter((line) => line.product.id !== productId));
  }

  function clearSale() {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setServiceMode('takeaway');
    setPaymentMethod('efectivo');
    setLastSale(null);
    setEditingSale(null);
  }

  async function startEditingSale(sale: CounterSaleListItem) {
    if (sale.status === 'cancelado') return;

    try {
      const detail = await getCounterSaleForEdit(sale.id);
      const editCart: CartLine[] = detail.items.map((item) => {
        if (!item.productId) {
          throw new Error(`La venta ${sale.orderCode} contiene un producto eliminado y no puede editarse de forma segura.`);
        }

        const currentProduct = products.find((product) => product.id === item.productId);
        const product: Product = currentProduct
          ? { ...currentProduct, currentPrice: item.unitPrice }
          : {
              id: item.productId,
              name: item.productName,
              slug: '',
              description: 'Producto de la venta original',
              imageUrl: item.imageUrl ?? '',
              categoryId: item.categoryId ?? '',
              currentPrice: item.unitPrice,
              active: false,
              available: false,
              featured: false,
              isPromotion: item.isPromotion,
              createdAt: item.createdAt,
              updatedAt: item.createdAt,
            };

        return { product, quantity: item.quantity };
      });

      setCart(editCart);
      setCustomerName(detail.customerName === 'Venta mostrador' ? '' : detail.customerName);
      setCustomerPhone(detail.customerPhone === 'Sin teléfono' ? '' : detail.customerPhone);
      setServiceMode(detail.serviceMode);
      setPaymentMethod(detail.paymentMethod);
      setNotes(detail.notes);
      setEditingSale({ id: detail.id, orderCode: detail.orderCode });
      setLastSale(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir la venta para editar.');
    }
  }

  async function confirmCancelSale() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelCounterSale(cancelTarget.id);
      toast.success(`Venta ${cancelTarget.orderCode} cancelada.`);
      setCancelTarget(null);

      if (sales.length === 1 && salesPage > 1) {
        setSalesPage((current) => current - 1);
      } else {
        await loadSales(salesPage, true);
      }

      if (editingSale?.id === cancelTarget.id) clearSale();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar la venta.');
    } finally {
      setCancelling(false);
    }
  }

  async function registerSale() {
    if (!cart.length) {
      toast.warning('Agregá al menos un producto antes de registrar la venta.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName,
        customerPhone,
        serviceMode,
        paymentMethod,
        notes,
        items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      };

      const result = editingSale
        ? await updateCounterSale(editingSale.id, payload)
        : await createCounterSale(payload);

      const wasEditing = Boolean(editingSale);
      clearSale();
      setLastSale({ orderCode: result.orderCode, total: result.total });

      if (wasEditing) {
        await loadSales(salesPage, true);
        toast.success(`Venta ${result.orderCode} actualizada correctamente.`);
      } else {
        if (salesPage !== 1) setSalesPage(1);
        else await loadSales(1, true);
        toast.success(`Venta ${result.orderCode} registrada correctamente.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la venta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-w-0">
      <AdminPageHeader
        eyebrow="Ventas presenciales"
        title="Venta mostrador"
        description="Registrá rápidamente ventas realizadas fuera de la web, sin pasar por el checkout del cliente."
      />

      {lastSale ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0" />
            <div>
              <p className="text-sm font-black">Venta guardada · {lastSale.orderCode}</p>
              <p className="mt-0.5 text-xs text-emerald-700">Total {formatCurrency(lastSale.total)}</p>
            </div>
          </div>
          <button type="button" onClick={() => setLastSale(null)} className="text-xs font-bold underline underline-offset-2">Ocultar</button>
        </div>
      ) : null}

      {editingSale ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-central-orange/30 bg-central-orange/10 px-4 py-3 text-central-carbon">
          <div className="flex items-center gap-3">
            <Edit3 size={19} className="shrink-0 text-central-orange" />
            <div>
              <p className="text-sm font-black">Editando venta · {editingSale.orderCode}</p>
              <p className="mt-0.5 text-xs text-neutral-600">Podés corregir productos, cantidades, cliente, modalidad, pago y observaciones.</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={clearSale}>Cancelar edición</Button>
        </div>
      ) : null}

      <section className="overflow-visible rounded-sm border border-neutral-200 bg-white shadow-soft">
        <div className="grid min-w-0 items-start gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 border-b border-neutral-200 bg-white p-4 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black text-central-carbon">Productos</h2>
                <p className="mt-1 text-xs text-neutral-500">Tocá un producto para agregarlo a la venta.</p>
              </div>
              <div className="flex h-10 w-full max-w-md items-center gap-2 rounded-sm border border-neutral-200 bg-neutral-50 px-3 focus-within:border-central-orange focus-within:ring-2 focus-within:ring-orange-100 sm:w-80">
                <Search size={16} className="text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar producto…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                />
              </div>
            </div>

            {visibleCategories.length ? (
              <div className="mb-4 -mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max min-w-full items-center gap-2" role="tablist" aria-label="Filtrar productos por categoría">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedCategoryId === 'all'}
                    onClick={() => setSelectedCategoryId('all')}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      selectedCategoryId === 'all'
                        ? 'border-central-orange/30 bg-central-orange/10 text-central-orange shadow-sm'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 hover:bg-white hover:text-central-carbon'
                    }`}
                  >
                    Todos
                  </button>
                  {visibleCategories.map((category) => {
                    const active = selectedCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                          active
                            ? 'border-central-orange/30 bg-central-orange/10 text-central-orange shadow-sm'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 hover:bg-white hover:text-central-carbon'
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-sm border border-neutral-200 bg-neutral-100" />
                ))}
              </div>
            ) : filteredProducts.length ? (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredProducts.map((product) => {
                  const quantity = cart.find((line) => line.product.id === product.id)?.quantity ?? 0;
                  const isSelected = quantity > 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      aria-pressed={isSelected}
                      className={`group min-w-0 rounded-sm border p-4 text-left shadow-sm transition ${
                        isSelected
                          ? 'border-central-orange/60 bg-central-orange/10 shadow-[0_8px_20px_rgba(234,88,12,.08)] hover:border-central-orange hover:bg-central-orange/15'
                          : 'border-neutral-200 bg-white hover:border-central-orange/40 hover:bg-orange-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-central-carbon">{product.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{product.description || 'Sin descripción'}</p>
                        </div>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm transition ${
                          isSelected
                            ? 'bg-central-orange text-white group-hover:brightness-95'
                            : 'bg-central-orange/10 text-central-orange group-hover:bg-central-orange group-hover:text-white'
                        }`}>
                          <Plus size={16} />
                        </span>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <p className="text-lg font-black text-central-carbon">{formatCurrency(product.currentPrice)}</p>
                        {quantity > 0 ? (
                          <span className="rounded-sm border border-central-orange/20 bg-white/80 px-2 py-1 text-[10px] font-black text-central-orange">{quantity} en venta</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">No hay productos que coincidan con los filtros.</div>
            )}
          </div>

          <aside className="min-w-0 self-start bg-white p-4 sm:p-5 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.12em] text-central-orange">Venta rápida</p>
                <h2 className="mt-1 text-xl font-black text-central-carbon">Resumen</h2>
              </div>
              <span className="rounded-sm border border-central-orange/20 bg-central-orange/10 px-2.5 py-1 text-xs font-black text-central-orange">{itemCount} ítems</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setServiceMode('takeaway')}
                className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-3 text-sm font-bold transition ${serviceMode === 'takeaway' ? 'border-central-orange bg-central-orange/10 text-central-orange' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'}`}
              >
                <ShoppingBag size={16} /> Para llevar
              </button>
              <button
                type="button"
                onClick={() => setServiceMode('dine_in')}
                className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-3 text-sm font-bold transition ${serviceMode === 'dine_in' ? 'border-central-orange bg-central-orange/10 text-central-orange' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'}`}
              >
                <UtensilsCrossed size={16} /> Comer ahí
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-bold text-neutral-500">Cliente <span className="font-normal">(opcional)</span></span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Ej. Juan" className="h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-central-orange focus:ring-2 focus:ring-orange-100" />
              </label>
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-bold text-neutral-500">Teléfono <span className="font-normal">(opcional)</span></span>
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Ej. 3794…" inputMode="tel" className="h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-central-orange focus:ring-2 focus:ring-orange-100" />
              </label>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold text-neutral-500">Medio de pago</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod('efectivo')} className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-xs font-bold transition ${paymentMethod === 'efectivo' ? 'border-central-orange bg-central-orange/10 text-central-orange' : 'border-neutral-200 text-neutral-500'}`}><Banknote size={15} /> Efectivo</button>
                <button type="button" onClick={() => setPaymentMethod('transferencia')} className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-xs font-bold transition ${paymentMethod === 'transferencia' ? 'border-central-orange bg-central-orange/10 text-central-orange' : 'border-neutral-200 text-neutral-500'}`}><CreditCard size={15} /> Transferencia</button>
              </div>
            </div>

            <div className="mt-5 border-y border-neutral-100 py-4">
              {cart.length ? (
                <div className="space-y-3">
                  {cart.map((line) => (
                    <div key={line.product.id} className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-central-carbon">{line.product.name}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{formatCurrency(line.product.currentPrice)} c/u</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-sm border border-neutral-200 bg-neutral-50 p-1">
                        <button type="button" onClick={() => changeQuantity(line.product.id, -1)} className="grid h-7 w-7 place-items-center rounded-sm text-neutral-500 hover:bg-white hover:text-central-carbon" aria-label={`Quitar una unidad de ${line.product.name}`}><Minus size={13} /></button>
                        <span className="w-7 text-center text-xs font-black">{line.quantity}</span>
                        <button type="button" onClick={() => changeQuantity(line.product.id, 1)} className="grid h-7 w-7 place-items-center rounded-sm text-neutral-500 hover:bg-white hover:text-central-carbon" aria-label={`Agregar una unidad de ${line.product.name}`}><Plus size={13} /></button>
                      </div>
                      <p className="w-20 shrink-0 text-right text-sm font-black text-central-carbon">{formatCurrency(line.product.currentPrice * line.quantity)}</p>
                      <button type="button" onClick={() => removeProduct(line.product.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-red-500 hover:bg-red-50" aria-label={`Eliminar ${line.product.name}`}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-7 text-center">
                  <Store className="mx-auto text-neutral-300" size={30} />
                  <p className="mt-3 text-sm font-bold text-neutral-500">Todavía no agregaste productos</p>
                  <p className="mt-1 text-xs text-neutral-400">Seleccioná productos desde el listado.</p>
                </div>
              )}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-bold text-neutral-500">Observaciones <span className="font-normal">(opcional)</span></span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Ej. sin cebolla, mesa del patio…" className="w-full resize-none rounded-sm border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-central-orange focus:ring-2 focus:ring-orange-100" />
            </label>

            <div className="mt-5 flex items-end justify-between gap-4 border-t border-neutral-200 pt-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Total</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-central-carbon">{formatCurrency(total)}</p>
              </div>
              {cart.length ? <button type="button" onClick={() => { setCart([]); setLastSale(null); }} className="text-xs font-bold text-neutral-400 hover:text-red-600">Vaciar</button> : null}
            </div>

            <button
              type="button"
              onClick={() => void registerSale()}
              disabled={submitting || !cart.length}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-central-orange bg-central-orange px-4 text-sm font-black text-white shadow-orange transition hover:brightness-95 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
            >
              {editingSale ? <Edit3 size={17} /> : <Store size={17} />}
              {submitting
                ? (editingSale ? 'Guardando cambios…' : 'Registrando venta…')
                : (editingSale ? 'Guardar cambios' : 'Registrar venta mostrador')}
            </button>

            <p className="mt-2 text-center text-[11px] leading-4 text-neutral-400">{editingSale ? 'Los cambios se reflejan automáticamente en Pedidos, Dashboard y Reportes.' : 'La venta se guarda como realizada y se suma automáticamente a Pedidos, Dashboard y Reportes.'}</p>
          </aside>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
        <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-black text-central-carbon">Ventas de mostrador registradas</h2>
            <p className="mt-1 text-xs text-neutral-500">Consultá, corregí o cancelá ventas presenciales. Se muestran hasta 10 registros por página.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadSales(salesPage)} disabled={salesLoading}>
            <RefreshCw size={15} className={salesLoading ? 'animate-spin' : ''} /> Actualizar
          </Button>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-neutral-50 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-4 py-3">Venta</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Modalidad</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {salesLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={9} className="px-5 py-4">
                      <div className="h-5 animate-pulse rounded bg-neutral-100" />
                    </td>
                  </tr>
                ))
              ) : sales.length ? (
                sales.map((sale) => {
                  const cancelled = sale.status === 'cancelado';
                  return (
                    <tr key={sale.id} className={`transition ${cancelled ? 'bg-red-50/30' : 'hover:bg-neutral-50/70'}`}>
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-3.5 font-extrabold text-central-orange">{sale.orderCode}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-central-carbon">{sale.customerName}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{sale.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600">{sale.serviceMode === 'dine_in' ? 'Comer ahí' : 'Para llevar'}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{sale.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-neutral-700">{sale.itemCount}</td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-central-carbon">{formatCurrency(sale.total)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-sm px-2 py-1 text-xs font-bold ${cancelled ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {cancelled ? 'Cancelada' : 'Realizada'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void startEditingSale(sale)}
                            disabled={cancelled || submitting}
                            className="grid h-8 w-8 place-items-center rounded-sm border border-neutral-200 text-neutral-500 transition hover:border-central-orange hover:text-central-orange disabled:cursor-not-allowed disabled:opacity-35"
                            title="Editar venta"
                            aria-label={`Editar ${sale.orderCode}`}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget(sale)}
                            disabled={cancelled || cancelling}
                            className="grid h-8 w-8 place-items-center rounded-sm border border-red-200 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"
                            title="Cancelar venta"
                            aria-label={`Cancelar ${sale.orderCode}`}
                          >
                            <XCircle size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-neutral-500">Todavía no hay ventas de mostrador registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={salesPage}
          pageSize={10}
          totalItems={salesTotal}
          onPageChange={setSalesPage}
        />
      </section>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancelar venta de mostrador"
        description={cancelTarget ? `¿Seguro que querés cancelar ${cancelTarget.orderCode}? La venta quedará en el historial como cancelada y dejará de contabilizarse como venta válida.` : ''}
        confirmLabel="Cancelar venta"
        tone="danger"
        isLoading={cancelling}
        onConfirm={() => void confirmCancelSale()}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
