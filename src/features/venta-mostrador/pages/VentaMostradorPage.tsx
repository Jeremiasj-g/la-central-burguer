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
    <div className="counter-wallet min-w-0 pb-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Punto de venta</h1>
          <p className="mt-1 text-[13px] leading-5 text-neutral-500">Armá, cobrá y registrá ventas en pocos pasos.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-neutral-200/70 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {editingSale ? 'Editando venta' : 'Venta presencial'}
        </div>
      </div>

      {lastSale ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[13px] border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold">Venta guardada · {lastSale.orderCode}</p>
              <p className="mt-0.5 text-xs text-emerald-700">Total {formatCurrency(lastSale.total)}</p>
            </div>
          </div>
          <button type="button" onClick={() => setLastSale(null)} className="text-xs font-medium underline underline-offset-2">Ocultar</button>
        </div>
      ) : null}

      {editingSale ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[13px] border border-central-orange/20 bg-central-orange/10 px-4 py-3 text-neutral-900">
          <div className="flex items-center gap-3">
            <Edit3 size={19} className="shrink-0 text-central-orange" />
            <div>
              <p className="text-sm font-semibold">Editando venta · {editingSale.orderCode}</p>
              <p className="mt-0.5 text-xs text-neutral-600">Podés corregir productos, cantidades, cliente, modalidad, pago y observaciones.</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={clearSale}>Cancelar edición</Button>
        </div>
      ) : null}

      <section className="min-w-0">
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-central-carbon">Productos</h2>
                <p className="mt-1 text-xs text-neutral-500">Tocá un producto para agregarlo a la venta.</p>
              </div>
              <div className="flex h-9 w-full max-w-md items-center gap-2 rounded-[11px] border border-neutral-200/80 bg-[#f7f7f9] px-3 transition-colors duration-200 focus-within:border-central-orange/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-central-orange/10 sm:w-72">
                <Search size={16} className="text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar producto…"
                  className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-neutral-400"
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
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition duration-200 ${
                      selectedCategoryId === 'all'
                        ? 'border-central-orange/20 bg-central-orange/10 text-central-orange'
                        : 'border-transparent bg-[#f7f7f9] text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
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
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition duration-200 ${
                          active
                            ? 'border-central-orange/20 bg-central-orange/10 text-central-orange'
                            : 'border-transparent bg-[#f7f7f9] text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
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
              <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-sm border border-neutral-200 bg-neutral-100" />
                ))}
              </div>
            ) : filteredProducts.length ? (
              <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredProducts.map((product) => {
                  const quantity = cart.find((line) => line.product.id === product.id)?.quantity ?? 0;
                  const isSelected = quantity > 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      aria-pressed={isSelected}
                      className={`group min-w-0 cursor-pointer rounded-[14px] border p-4 text-left transition-all duration-200 active:scale-[.99] ${
                        isSelected
                          ? 'border-central-orange/40 bg-[#fff8ed] hover:border-central-orange/70 hover:bg-[#fff3e0]'
                          : 'border-neutral-200/70 bg-[#fafafa] hover:border-neutral-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-central-carbon">{product.name}</p>
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
                        <p className="text-lg font-semibold text-central-carbon">{formatCurrency(product.currentPrice)}</p>
                        {quantity > 0 ? (
                          <span className="rounded-sm border border-central-orange/20 bg-white/80 px-2 py-1 text-[10px] font-semibold text-central-orange">{quantity} en venta</span>
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

          <aside className="min-w-0 self-start rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
            <div className="relative overflow-hidden rounded-[18px] bg-[#191b20] px-5 py-5 text-white">
              <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-central-orange/10 blur-[42px]" aria-hidden="true" />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[.12em] text-white/50">{editingSale ? 'Actualizar venta' : 'Cobro en mostrador'}</p>
                <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/10 bg-white/[.07] text-white/75"><ShoppingBag size={16} /></span>
              </div>
              <p className="relative mt-1 text-[12px] text-white/55">Total a cobrar</p>
              <p className="relative mt-3 break-words text-[clamp(2.35rem,3.5vw,3.1rem)] font-semibold leading-none tracking-[-.055em] [font-variant-numeric:tabular-nums]">{formatCurrency(total)}</p>
              <div className="relative mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                <span className="text-[11px] text-white/55">{itemCount} {itemCount === 1 ? 'unidad' : 'unidades'} en esta venta</span>
                {cart.length ? <button type="button" onClick={() => { setCart([]); setLastSale(null); }} className="cursor-pointer text-[11px] font-medium text-white/65 transition hover:text-white">Vaciar venta</button> : null}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight text-neutral-900">Datos del cobro</h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">Modalidad y medio de pago</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setServiceMode('takeaway')}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border px-2 py-2.5 text-[12px] font-medium transition-colors duration-200 ${serviceMode === 'takeaway' ? 'border-central-orange/25 bg-central-orange/10 text-central-orange' : 'border-transparent bg-[#f7f7f9] text-neutral-500 hover:bg-neutral-100'}`}
              >
                <ShoppingBag size={16} /> Para llevar
              </button>
              <button
                type="button"
                onClick={() => setServiceMode('dine_in')}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border px-2 py-2.5 text-[12px] font-medium transition-colors duration-200 ${serviceMode === 'dine_in' ? 'border-central-orange/25 bg-central-orange/10 text-central-orange' : 'border-transparent bg-[#f7f7f9] text-neutral-500 hover:bg-neutral-100'}`}
              >
                <UtensilsCrossed size={16} /> Comer ahí
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500">Cliente <span className="font-normal">(opcional)</span></span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Ej. Juan" className="h-9 w-full rounded-[11px] border border-neutral-200/70 bg-[#f7f7f9] px-3 text-[12px] font-normal outline-none transition-colors duration-200 focus:border-central-orange/40 focus:bg-white focus:ring-2 focus:ring-central-orange/10" />
              </label>
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500">Teléfono <span className="font-normal">(opcional)</span></span>
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Ej. 3794…" inputMode="tel" className="h-9 w-full rounded-[11px] border border-neutral-200/70 bg-[#f7f7f9] px-3 text-[12px] font-normal outline-none transition-colors duration-200 focus:border-central-orange/40 focus:bg-white focus:ring-2 focus:ring-central-orange/10" />
              </label>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-neutral-500">Medio de pago</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod('efectivo')} className={`flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border px-2 py-2.5 text-[12px] font-medium transition-colors duration-200 ${paymentMethod === 'efectivo' ? 'border-central-orange/25 bg-central-orange/10 text-central-orange' : 'border-transparent bg-[#f7f7f9] text-neutral-500 hover:bg-neutral-100'}`}><Banknote size={15} /> Efectivo</button>
                <button type="button" onClick={() => setPaymentMethod('transferencia')} className={`flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border px-2 py-2.5 text-[12px] font-medium transition-colors duration-200 ${paymentMethod === 'transferencia' ? 'border-central-orange/25 bg-central-orange/10 text-central-orange' : 'border-transparent bg-[#f7f7f9] text-neutral-500 hover:bg-neutral-100'}`}><CreditCard size={15} /> Transferencia</button>
              </div>
            </div>

            <div className="mt-5 border-t border-neutral-100 pt-4">
              {cart.length ? (
                <div className="space-y-3">
                  {cart.map((line) => (
                    <div key={line.product.id} className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-central-carbon">{line.product.name}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{formatCurrency(line.product.currentPrice)} c/u</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-[10px] bg-[#f1f1f3] p-1">
                        <button type="button" onClick={() => changeQuantity(line.product.id, -1)} className="grid h-7 w-7 place-items-center rounded-sm text-neutral-500 hover:bg-white hover:text-central-carbon" aria-label={`Quitar una unidad de ${line.product.name}`}><Minus size={13} /></button>
                        <span className="w-7 text-center text-xs font-semibold">{line.quantity}</span>
                        <button type="button" onClick={() => changeQuantity(line.product.id, 1)} className="grid h-7 w-7 place-items-center rounded-sm text-neutral-500 hover:bg-white hover:text-central-carbon" aria-label={`Agregar una unidad de ${line.product.name}`}><Plus size={13} /></button>
                      </div>
                      <p className="w-20 shrink-0 text-right text-sm font-semibold text-central-carbon">{formatCurrency(line.product.currentPrice * line.quantity)}</p>
                      <button type="button" onClick={() => removeProduct(line.product.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-red-500 hover:bg-red-50" aria-label={`Eliminar ${line.product.name}`}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-7 text-center">
                  <Store className="mx-auto text-neutral-300" size={30} />
                  <p className="mt-3 text-sm font-medium text-neutral-500">Todavía no agregaste productos</p>
                  <p className="mt-1 text-xs text-neutral-400">Seleccioná productos desde el listado.</p>
                </div>
              )}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">Observaciones <span className="font-normal">(opcional)</span></span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Ej. sin cebolla, mesa del patio…" className="w-full resize-none rounded-[11px] border border-neutral-200/70 bg-[#f7f7f9] px-3 py-2.5 text-[12px] font-normal outline-none transition-colors duration-200 focus:border-central-orange/40 focus:bg-white focus:ring-2 focus:ring-central-orange/10" />
            </label>

            <button
              type="button"
              onClick={() => void registerSale()}
              disabled={submitting || !cart.length}
              className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-central-orange px-4 text-[13px] font-semibold text-white transition duration-200 hover:bg-central-ember active:scale-[.99] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
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

      <section className="mt-6 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-soft">
        <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold text-central-carbon">Ventas de mostrador registradas</h2>
            <p className="mt-1 text-xs text-neutral-500">Consultá, corregí o cancelá ventas presenciales. Se muestran hasta 10 registros por página.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadSales(salesPage)} disabled={salesLoading}>
            <RefreshCw size={15} className={salesLoading ? 'animate-spin' : ''} /> Actualizar
          </Button>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-[12px]">
            <thead className="border-b border-neutral-100 bg-[#f8f8f9] text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
              <tr>
                <th className="px-5 py-3.5">Fecha</th>
                <th className="px-4 py-3.5">Venta / Cliente</th>
                <th className="px-4 py-3.5">Modalidad y pago</th>
                <th className="px-4 py-3.5 text-right">Unidades</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {salesLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}><td colSpan={7} className="px-5 py-4"><div className="h-5 animate-pulse rounded-lg bg-neutral-100" /></td></tr>
                ))
              ) : sales.length ? (
                sales.map((sale) => {
                  const cancelled = sale.status === 'cancelado';
                  return (
                    <tr key={sale.id} className={cancelled ? 'bg-red-50/30 transition-colors duration-200' : 'transition-colors duration-200 hover:bg-[#fafafa]'}>
                      <td className="whitespace-nowrap px-5 py-4 text-neutral-500">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-neutral-900">{sale.orderCode}</p>
                        <p className="mt-0.5 max-w-[210px] truncate text-[11px] text-neutral-500" title={sale.customerName}>{sale.customerName}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-neutral-800">{sale.serviceMode === 'dine_in' ? 'Comer ahí' : 'Para llevar'}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-400">{sale.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-neutral-600">{sale.itemCount}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-neutral-900 [font-variant-numeric:tabular-nums]">{formatCurrency(sale.total)}</td>
                      <td className="px-4 py-4">
                        <span className={cancelled
                          ? 'inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700'
                          : 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700'}>
                          {cancelled ? 'Cancelada' : 'Realizada'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => void startEditingSale(sale)} disabled={cancelled || submitting}
                            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border border-neutral-200 bg-white text-neutral-500 transition-colors duration-200 hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-35"
                            title="Editar venta" aria-label={`Editar ${sale.orderCode}`}>
                            <Edit3 size={14} />
                          </button>
                          <button type="button" onClick={() => setCancelTarget(sale)} disabled={cancelled || cancelling}
                            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border border-red-200 bg-white text-red-500 transition-colors duration-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"
                            title="Cancelar venta" aria-label={`Cancelar ${sale.orderCode}`}>
                            <XCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-[12px] text-neutral-500">Todavía no hay ventas de mostrador registradas.</td></tr>
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
