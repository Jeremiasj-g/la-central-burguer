'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Modal } from '@/shared/components/ui/Modal';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { formatCurrency } from '@/shared/utils/format.utils';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { useCategoryDiscounts } from '@/features/promociones/hooks/useCategoryDiscounts';
import { businessDate, discountForProduct, discountedPrice } from '@/features/promociones/utils/descuentos.utils';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { editPedidoItems } from '../services/pedidos.service';
import type { Order } from '../types/pedido.types';

type EditLine = {
  key: string;
  itemId?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  note: string;
};

function initialLines(order: Order): EditLine[] {
  return order.items.map(item => ({
    key: item.id,
    itemId: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    note: item.note ?? '',
  }));
}

const field = '!rounded-[10px] !border-neutral-200 !bg-white !text-[13px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400';

export function PedidoEditModal({ order, onClose, onSaved }: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState<EditLine[]>(() => initialLines(order));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const { productos, isLoading: loadingProducts, error: productsError } = useProductos({ active: 'active', available: 'available' });
  const { campaigns, loading: loadingCampaigns, error: campaignsError } = useCategoryDiscounts();
  const { config } = useBusinessConfig();
  const today = businessDate(new Date(), config?.timezone);

  const productsById = useMemo(() => new Map(productos.map(product => [product.id, product])), [productos]);
  const normalizedSearch = search.trim().toLocaleLowerCase('es');
  const availableProducts = productos
    .filter(product => !normalizedSearch || product.name.toLocaleLowerCase('es').includes(normalizedSearch))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  function currentUnitPrice(line: EditLine) {
    if (line.itemId) return line.unitPrice; // Precio histórico, no lo recalculamos.
    const product = productsById.get(line.productId);
    if (!product) return line.unitPrice;
    const discount = discountForProduct(campaigns, product.id, product.categoryId, today);
    return discountedPrice(product.currentPrice, discount);
  }

  const subtotal = lines.reduce((sum, line) => sum + currentUnitPrice(line) * line.quantity, 0);
  const total = subtotal + order.deliveryCost;
  const delta = total - order.total;
  const dirty = JSON.stringify(lines.map(line => [line.itemId, line.productId, line.quantity, line.note])) !==
    JSON.stringify(initialLines(order).map(line => [line.itemId, line.productId, line.quantity, line.note]));
  const canSave = dirty && lines.length > 0 && !saving && !loadingProducts && !loadingCampaigns && !productsError && !campaignsError;

  function updateLine(key: string, values: Partial<EditLine>) {
    setLines(current => current.map(line => line.key === key ? { ...line, ...values } : line));
  }

  function addProduct(productId: string) {
    const product = productsById.get(productId);
    if (!product) return;
    setLines(current => [...current, {
      key: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      note: '',
      unitPrice: product.currentPrice,
    }]);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await editPedidoItems(order.id, order.updatedAt, lines.map(line =>
        line.itemId
          ? { itemId: line.itemId, quantity: line.quantity, note: line.note }
          : { productId: line.productId, quantity: line.quantity, note: line.note },
      ));
      toast.success(`Pedido actualizado. Nuevo total: ${formatCurrency(result.newTotal)}`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo editar el pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => { if (!saving) onClose(); }}
      title={`Editar pedido ${order.orderCode}`}
      size="lg"
      theme="light"
      panelClassName="!rounded-[20px]"
      titleClassName="!text-[17px] !font-semibold !tracking-[-.03em]"
      footerClassName="border-t border-neutral-100 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4"
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] text-neutral-500">
              Total anterior: {formatCurrency(order.total)} · Envío sin cambios
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <strong className="text-[20px] font-semibold tracking-[-.04em] text-neutral-900">{formatCurrency(total)}</strong>
              {dirty ? <span className={`text-[12px] font-medium ${delta > 0 ? 'text-amber-700' : delta < 0 ? 'text-emerald-700' : 'text-neutral-500'}`}>
                {delta > 0 ? '+' : ''}{formatCurrency(delta)} de diferencia
              </span> : null}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}
              className="!h-11 !rounded-[11px] !text-[12px]">Cancelar</Button>
            <Button type="button" onClick={() => void save()} disabled={!canSave}
              className="!h-11 !rounded-[11px] !bg-[#191b20] !px-4 !text-[12px] !font-medium !text-white disabled:!opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        <p className="text-[12px] leading-5 text-neutral-500">
          Podés cambiar cantidades, aclaraciones y agregar o quitar productos. El pedido conservará su código, los precios originales de los ítems existentes y el importe de envío.
        </p>
        <section aria-label="Productos del pedido">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-neutral-900">Productos del pedido</h3>
            <span className="text-[11px] text-neutral-500">{lines.length} {lines.length === 1 ? 'renglón' : 'renglones'}</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {lines.map(line => (
              <div key={line.key} className="min-w-0 py-3 first:pt-1">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[13px] font-medium text-neutral-900">{line.productName}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {formatCurrency(currentUnitPrice(line))} por unidad
                      {!line.itemId ? ' · Agregado ahora' : ''}
                    </p>
                  </div>
                  <strong className="shrink-0 text-[13px] font-semibold tabular-nums text-neutral-900">
                    {formatCurrency(currentUnitPrice(line) * line.quantity)}
                  </strong>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex h-10 items-center rounded-[10px] border border-neutral-200 bg-white">
                    <button type="button" aria-label={`Quitar una unidad de ${line.productName}`}
                      onClick={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                      disabled={line.quantity <= 1}
                      className="grid h-10 w-10 place-items-center text-neutral-700 disabled:opacity-30"><Minus size={15}/></button>
                    <span className="min-w-6 text-center text-[13px] font-medium tabular-nums">{line.quantity}</span>
                    <button type="button" aria-label={`Agregar una unidad de ${line.productName}`}
                      onClick={() => updateLine(line.key, { quantity: Math.min(99, line.quantity + 1) })}
                      disabled={line.quantity >= 99}
                      className="grid h-10 w-10 place-items-center text-neutral-700 disabled:opacity-30"><Plus size={15}/></button>
                  </div>
                  <button type="button" disabled={lines.length <= 1}
                    onClick={() => setLines(current => current.filter(item => item.key !== line.key))}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-[12px] font-medium text-red-600 transition-colors duration-200 hover:bg-red-50 disabled:opacity-30">
                    <Trash2 size={15}/> Quitar
                  </button>
                </div>
                <label htmlFor={`order-item-note-${line.key}`} className="mt-2 block text-[11px] font-medium text-neutral-600">
                  Aclaraciones del producto <span className="font-normal text-neutral-400">(opcional)</span>
                </label>
                <Input
                  id={`order-item-note-${line.key}`}
                  value={line.note}
                  onChange={event => updateLine(line.key, { note: event.target.value })}
                  maxLength={500}
                  placeholder="Ej.: sin cebolla, sin mayonesa..."
                  className={`mt-1.5 ${field} !h-10`}
                />
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Agregar productos" className="min-w-0 border-t border-neutral-100 pt-4">
          <h3 className="text-[14px] font-semibold text-neutral-900">Agregar productos</h3>
          <label className="relative mt-2 block">
            <span className="sr-only">Buscar producto</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
            <Input type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Buscar en el menú" className={`!pl-10 ${field}`} />
          </label>
          {loadingProducts || loadingCampaigns ? (
            <p role="status" className="py-5 text-center text-[12px] text-neutral-500">Cargando catálogo y ofertas...</p>
          ) : productsError || campaignsError ? (
            <p role="alert" className="py-3 text-[12px] text-red-600">
              No se pudo cargar el menú actualizado. Cerrá y volvé a abrir la edición.
            </p>
          ) : (
            <div className="custom-scrollbar mt-2 max-h-[240px] divide-y divide-neutral-100 overflow-y-auto">
              {availableProducts.length === 0 ? (
                <p className="py-5 text-center text-[12px] text-neutral-500">No hay productos que coincidan.</p>
              ) : availableProducts.map(product => {
                const price = discountedPrice(product.currentPrice, discountForProduct(campaigns, product.id, product.categoryId, today));
                return (
                  <div key={product.id} className="flex min-h-14 min-w-0 items-center justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[12px] font-medium text-neutral-900">{product.name}</p>
                      <p className="text-[11px] text-neutral-500">{formatCurrency(price)}</p>
                    </div>
                    <button type="button" onClick={() => addProduct(product.id)}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-[10px] bg-[#f4f4f5] px-3 text-[12px] font-medium text-neutral-800 transition-colors duration-200 hover:bg-neutral-200">
                      <Plus size={15}/> Agregar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <p className="border-t border-neutral-100 pt-3 text-[11px] leading-5 text-neutral-500">
          Al guardar se actualizará el total del pedido y quedará registrado el cambio. <strong className="font-medium text-neutral-700">Avisale al cliente</strong> cualquier diferencia de cobro; el sistema no envía ni cobra automáticamente el ajuste.
        </p>
      </div>
    </Modal>
  );
}
