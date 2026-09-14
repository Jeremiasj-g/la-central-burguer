'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { formatCurrency } from '@/shared/utils/format.utils';
import { getProductos, subscribeToProducts } from '@/features/productos/services/productos.service';
import type { Product } from '@/features/productos/types/producto.types';
import {
  createCounterSale,
  type CounterPaymentMethod,
  type CounterServiceMode,
} from '../services/venta-mostrador.service';

type CartLine = {
  product: Product;
  quantity: number;
};

export function VentaMostradorPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serviceMode, setServiceMode] = useState<CounterServiceMode>('takeaway');
  const [paymentMethod, setPaymentMethod] = useState<CounterPaymentMethod>('efectivo');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lastSale, setLastSale] = useState<{ orderCode: string; total: number } | null>(null);

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

  useEffect(() => {
    void loadProducts();
    return subscribeToProducts(() => void loadProducts(true));
  }, []);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.description].some((value) => value.toLocaleLowerCase('es').includes(normalized)),
    );
  }, [products, query]);

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
    setLastSale(null);
  }

  async function registerSale() {
    if (!cart.length) {
      toast.warning('Agregá al menos un producto antes de registrar la venta.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCounterSale({
        customerName,
        customerPhone,
        serviceMode,
        paymentMethod,
        notes,
        items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      });

      setLastSale({ orderCode: result.orderCode, total: result.total });
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      toast.success(`Venta ${result.orderCode} registrada correctamente.`);
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

      <div className="mb-6 flex items-start gap-3 rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
        <AlertTriangle className="mt-0.5 shrink-0" size={18} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black uppercase tracking-[.08em]">Módulo en desarrollo</p>
            <span className="rounded-sm border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em] text-red-700">Beta</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-red-600">
            La venta ya se registra dentro de Pedidos y Reportes, pero esta pantalla todavía puede recibir ajustes de flujo y diseño.
          </p>
        </div>
      </div>

      {lastSale ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0" />
            <div>
              <p className="text-sm font-black">Venta registrada · {lastSale.orderCode}</p>
              <p className="mt-0.5 text-xs text-emerald-700">Total {formatCurrency(lastSale.total)}</p>
            </div>
          </div>
          <button type="button" onClick={() => setLastSale(null)} className="text-xs font-bold underline underline-offset-2">Ocultar</button>
        </div>
      ) : null}

      <section className="overflow-visible rounded-sm border-2 border-red-200 bg-red-50/30 shadow-soft">
        <div className="grid min-w-0 items-start gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 border-b border-red-100 bg-white p-4 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black text-central-carbon">Productos</h2>
                <p className="mt-1 text-xs text-neutral-500">Tocá un producto para agregarlo a la venta.</p>
              </div>
              <div className="flex h-10 w-full max-w-md items-center gap-2 rounded-sm border border-neutral-200 bg-neutral-50 px-3 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-100 sm:w-80">
                <Search size={16} className="text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar producto…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                />
              </div>
            </div>

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
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="group min-w-0 rounded-sm border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-red-300 hover:bg-red-50/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-central-carbon">{product.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{product.description || 'Sin descripción'}</p>
                        </div>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-red-50 text-red-600 transition group-hover:bg-red-600 group-hover:text-white">
                          <Plus size={16} />
                        </span>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <p className="text-lg font-black text-central-carbon">{formatCurrency(product.currentPrice)}</p>
                        {quantity > 0 ? (
                          <span className="rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">{quantity} en venta</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">No hay productos que coincidan con la búsqueda.</div>
            )}
          </div>

          <aside className="min-w-0 self-start bg-white p-4 sm:p-5 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.12em] text-red-600">Venta rápida</p>
                <h2 className="mt-1 text-xl font-black text-central-carbon">Resumen</h2>
              </div>
              <span className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">{itemCount} ítems</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setServiceMode('takeaway')}
                className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-3 text-sm font-bold transition ${serviceMode === 'takeaway' ? 'border-red-500 bg-red-50 text-red-700' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'}`}
              >
                <ShoppingBag size={16} /> Para llevar
              </button>
              <button
                type="button"
                onClick={() => setServiceMode('dine_in')}
                className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-3 text-sm font-bold transition ${serviceMode === 'dine_in' ? 'border-red-500 bg-red-50 text-red-700' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'}`}
              >
                <UtensilsCrossed size={16} /> Comer ahí
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-bold text-neutral-500">Cliente <span className="font-normal">(opcional)</span></span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Ej. Juan" className="h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100" />
              </label>
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-bold text-neutral-500">Teléfono <span className="font-normal">(opcional)</span></span>
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Ej. 3794…" inputMode="tel" className="h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100" />
              </label>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold text-neutral-500">Medio de pago</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod('efectivo')} className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-xs font-bold transition ${paymentMethod === 'efectivo' ? 'border-red-500 bg-red-50 text-red-700' : 'border-neutral-200 text-neutral-500'}`}><Banknote size={15} /> Efectivo</button>
                <button type="button" onClick={() => setPaymentMethod('transferencia')} className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-xs font-bold transition ${paymentMethod === 'transferencia' ? 'border-red-500 bg-red-50 text-red-700' : 'border-neutral-200 text-neutral-500'}`}><CreditCard size={15} /> Transferencia</button>
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
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Ej. sin cebolla, mesa del patio…" className="w-full resize-none rounded-sm border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100" />
            </label>

            <div className="mt-5 flex items-end justify-between gap-4 border-t border-neutral-200 pt-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Total</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-central-carbon">{formatCurrency(total)}</p>
              </div>
              {cart.length ? <button type="button" onClick={clearSale} className="text-xs font-bold text-neutral-400 hover:text-red-600">Vaciar</button> : null}
            </div>

            <button
              type="button"
              onClick={() => void registerSale()}
              disabled={submitting || !cart.length}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-red-700 bg-red-600 px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(220,38,38,.18)] transition hover:bg-red-700 disabled:cursor-not-allowed disabled:border-red-200 disabled:bg-red-200 disabled:text-red-400 disabled:shadow-none"
            >
              <Store size={17} /> {submitting ? 'Registrando venta…' : 'Registrar venta mostrador'}
            </button>

            <p className="mt-2 text-center text-[11px] leading-4 text-neutral-400">La venta se guarda como realizada y se suma automáticamente a Pedidos, Dashboard y Reportes.</p>
          </aside>
        </div>
      </section>
    </div>
  );
}