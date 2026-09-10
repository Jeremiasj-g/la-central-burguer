'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import type { CartItem } from '@/features/carrito/types/carrito.types';
import type { CheckoutFormValues } from '../types/checkout.types';
import { useCheckout } from '../hooks/useCheckout';
import { getDeliveryQuote } from '@/features/delivery/services/delivery.service';
import type { DeliveryQuote } from '@/features/delivery/types/delivery.types';
import { formatDistanceKm } from '@/features/delivery/utils/delivery.utils';
import { useCurrentLocation } from '@/features/delivery/hooks/useCurrentLocation';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Modal } from '@/shared/components/ui/Modal';
import { Textarea } from '@/shared/components/ui/Textarea';
import { formatCurrency } from '@/shared/utils/format.utils';
import { calculateCartTotals } from '@/features/carrito/services/carrito.service';
import { cn } from '@/shared/utils/cn';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import {
  EMPTY_CHECKOUT_VALUES,
  getCheckoutDraft,
  saveCheckoutDraft,
} from '../services/checkout-draft.service';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onOrderCreated?: () => void;
}

function RequiredMark() {
  return <span className="ml-1 text-central-orange" aria-hidden="true">*</span>;
}

function hasFiniteNonNegativeValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function CheckoutModal({ open, onClose, items, onOrderCreated }: CheckoutModalProps) {
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [isQuotingDelivery, setIsQuotingDelivery] = useState(false);
  const [values, setValues] = useState<CheckoutFormValues>(EMPTY_CHECKOUT_VALUES);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const { submit, isSubmitting, errors, createdOrder, setCreatedOrder, clearError } = useCheckout();
  const { config } = useBusinessConfig();
  const activePaymentMethods = useMemo(
    () => config?.paymentMethods.filter((method) => method.active) ?? [],
    [config],
  );
  const { isLoading: isGettingLocation, requestLocation, clearLocation } = useCurrentLocation();
  const isDelivery = values.deliveryMethod === 'delivery';
  const hasValidDeliveryQuote = !isDelivery || Boolean(
    values.customerLocation
      && values.deliveryMapsUrl
      && hasFiniteNonNegativeValue(values.deliveryDistanceKm)
      && hasFiniteNonNegativeValue(values.deliveryCost)
      && deliveryQuote?.isWithinRange !== false,
  );
  const totals = useMemo(
    () => calculateCartTotals(items, isDelivery ? values.deliveryCost ?? 0 : 0),
    [isDelivery, items, values.deliveryCost],
  );

  useEffect(() => {
    if (!open || isDraftHydrated) return;

    const draft = getCheckoutDraft();
    setValues(draft);
    if (
      draft.customerLocation
      && typeof draft.deliveryDistanceKm === 'number'
      && draft.deliveryMapsUrl
    ) {
      setDeliveryQuote({
        distanceKm: draft.deliveryDistanceKm,
        deliveryCost: draft.deliveryCost ?? 0,
        isWithinRange: typeof draft.deliveryCost === 'number',
        mapsUrl: draft.deliveryMapsUrl,
      });
    }
    setIsDraftHydrated(true);
  }, [isDraftHydrated, open]);

  useEffect(() => {
    if (!isDraftHydrated || createdOrder) return;

    const timeoutId = window.setTimeout(() => {
      saveCheckoutDraft(values);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [createdOrder, isDraftHydrated, values]);

  useEffect(() => {
    if (!activePaymentMethods.length) return;
    if (!activePaymentMethods.some((method) => method.type === values.paymentMethod)) {
      setValues((current) => ({ ...current, paymentMethod: activePaymentMethods[0].type }));
    }
  }, [activePaymentMethods, values.paymentMethod]);

  function update<K extends keyof CheckoutFormValues>(key: K, value: CheckoutFormValues[K]) {
    clearError(key);
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setDeliveryMethod(method: CheckoutFormValues['deliveryMethod']) {
    clearError('customerLocation');
    clearError('address');

    if (method === 'retiro_local') {
      clearLocation();
      setDeliveryQuote(null);
      setValues((current) => ({
        ...current,
        deliveryMethod: method,
        address: '',
        customerLocation: null,
        deliveryDistanceKm: undefined,
        deliveryCost: undefined,
        deliveryMapsUrl: undefined,
      }));
      return;
    }

    setValues((current) => ({ ...current, deliveryMethod: method, address: '' }));
  }

  async function attachCurrentLocation() {
    clearError('customerLocation');
    const location = await requestLocation();
    if (!location) return;

    setIsQuotingDelivery(true);
    try {
      const quote = await getDeliveryQuote(location);
      if (!quote) {
        clearLocation();
        setDeliveryQuote(null);
        setValues((current) => ({
          ...current,
          address: '',
          customerLocation: null,
          deliveryDistanceKm: undefined,
          deliveryCost: undefined,
          deliveryMapsUrl: undefined,
        }));
        toast.error('No pudimos calcular el envío. Verificá la ubicación del local e intentá nuevamente.');
        return;
      }

      setDeliveryQuote(quote);
      setValues((current) => ({
        ...current,
        address: '',
        customerLocation: location,
        deliveryDistanceKm: quote.distanceKm,
        deliveryCost: quote.isWithinRange ? quote.deliveryCost : undefined,
        deliveryMapsUrl: quote.mapsUrl,
      }));

      if (!quote.isWithinRange) {
        toast.warning('Esta ubicación está fuera del radio de entrega configurado.');
      }
    } catch (error) {
      clearLocation();
      setDeliveryQuote(null);
      setValues((current) => ({
        ...current,
        address: '',
        customerLocation: null,
        deliveryDistanceKm: undefined,
        deliveryCost: undefined,
        deliveryMapsUrl: undefined,
      }));
      const message = error instanceof Error ? error.message : 'No pudimos calcular el envío.';
      toast.error(message);
    } finally {
      setIsQuotingDelivery(false);
    }
  }

  function removeLocation() {
    clearError('customerLocation');
    clearLocation();
    setDeliveryQuote(null);
    setValues((current) => ({
      ...current,
      address: '',
      customerLocation: null,
      deliveryDistanceKm: undefined,
      deliveryCost: undefined,
      deliveryMapsUrl: undefined,
    }));
  }

  async function handleSubmit() {
    const order = await submit(values, items);
    if (order) {
      setConfirmSendOpen(false);
      setDeliveryQuote(null);
      clearLocation();
      setValues(EMPTY_CHECKOUT_VALUES);
      onOrderCreated?.();
    }
  }

  const deliveryHelperText = deliveryQuote
    ? deliveryQuote.isWithinRange
      ? `Distancia aproximada: ${formatDistanceKm(deliveryQuote.distanceKm)} · Envío: ${formatCurrency(deliveryQuote.deliveryCost)}`
      : `Distancia aproximada: ${formatDistanceKm(deliveryQuote.distanceKm)} · Fuera del radio de entrega.`
    : 'Para solicitar delivery, activá el GPS y compartí tu ubicación actual. La utilizaremos para calcular el envío y localizar la entrega.';

  const canSendOrder = !isSubmitting
    && items.length > 0
    && activePaymentMethods.length > 0
    && hasValidDeliveryQuote;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={createdOrder ? 'Pedido creado' : 'Datos de contacto y entrega'}
      theme="dark"
      size="lg"
      panelClassName="max-sm:max-w-[calc(100vw-1.5rem)]"
    >
      {createdOrder ? (
        <div className="space-y-4">
          <div className="rounded-sm border border-central-orange/30 bg-central-orange/10 p-4 text-center sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-central-orange sm:text-xs">Gracias por tu compra</p>
            <h3 className="mt-2 text-xl font-black text-white sm:text-2xl">Tu pedido fue confirmado</h3>
            <p className="mt-2 text-xs leading-5 text-white/65 sm:mt-3 sm:text-sm sm:leading-6">Ya registramos tu pedido en el panel de {config?.businessName ?? 'La Central Burger'} y abrimos WhatsApp con el detalle para coordinarlo.</p>
            <div className="mx-auto mt-4 max-w-xs rounded-sm border border-white/10 bg-black/30 p-3 sm:mt-5 sm:p-4">
              <p className="text-[10px] font-bold text-white/50 sm:text-xs">Código de pedido</p>
              <p className="mt-1 font-mono text-xl font-black text-central-orange sm:text-2xl">{createdOrder.orderCode}</p>
            </div>
          </div>
          <Button size="sm" className="w-full sm:h-11" onClick={() => { setCreatedOrder(null); onClose(); }}>Entendido</Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:gap-6">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-white/80 sm:mb-2 sm:text-sm">Nombre completo<RequiredMark /></label>
              <Input autoComplete="name" enterKeyHint="next" value={values.customerName} onChange={(event) => update('customerName', event.target.value)} placeholder="Tu nombre" />
              {errors.customerName ? <p className="mt-1 text-xs text-red-300">{errors.customerName}</p> : null}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-white/80 sm:mb-2 sm:text-sm">Teléfono<RequiredMark /></label>
              <Input type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" value={values.customerPhone} onChange={(event) => update('customerPhone', event.target.value)} placeholder="Tu número de WhatsApp" />
              {errors.customerPhone ? <p className="mt-1 text-xs text-red-300">{errors.customerPhone}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-white/80 sm:mb-3 sm:text-sm">Opciones de entrega<RequiredMark /></label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-sm border p-3 text-xs font-bold transition-[border-color,background-color,color,transform] duration-200 ease-out active:scale-[.99] motion-reduce:transition-none sm:gap-3 sm:p-4 sm:text-sm', isDelivery ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 bg-white/[.035] text-white/70 hover:border-central-orange/50')}>
                  <input type="radio" className="accent-central-orange" checked={isDelivery} onChange={() => setDeliveryMethod('delivery')} /> Envío
                </label>
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-sm border p-3 text-xs font-bold transition-[border-color,background-color,color,transform] duration-200 ease-out active:scale-[.99] motion-reduce:transition-none sm:gap-3 sm:p-4 sm:text-sm', values.deliveryMethod === 'retiro_local' ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 bg-white/[.035] text-white/70 hover:border-central-orange/50')}>
                  <input type="radio" className="accent-central-orange" checked={values.deliveryMethod === 'retiro_local'} onChange={() => setDeliveryMethod('retiro_local')} /> Retiro
                </label>
              </div>
            </div>

            <div
              aria-hidden={!isDelivery}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
                isDelivery ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-white/80 sm:mb-2 sm:text-sm">
                    Ubicación GPS<RequiredMark />
                  </label>
                  <div className={cn(
                    'rounded-sm border bg-white/[.035] p-3 transition-colors duration-200 motion-reduce:transition-none',
                    deliveryQuote && !deliveryQuote.isWithinRange ? 'border-red-400/35' : 'border-white/10',
                  )}>
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-xs font-black text-white sm:text-sm"><MapPin size={15} className="text-central-orange" /> Compartir ubicación actual</p>
                        <p className={cn('mt-1 text-[11px] leading-4 sm:text-xs sm:leading-5', deliveryQuote && !deliveryQuote.isWithinRange ? 'text-red-200/80' : 'text-white/50')}>{deliveryHelperText}</p>
                      </div>
                      {values.customerLocation ? (
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-white/70 hover:bg-white/10" title="Quitar ubicación adjunta" onClick={removeLocation} disabled={!isDelivery}>
                          <XCircle size={14} /> Quitar
                        </Button>
                      ) : (
                        <Button type="button" variant="secondary" size="sm" className="h-8 px-2 text-xs" title="Compartir ubicación GPS actual" onClick={attachCurrentLocation} disabled={!isDelivery || isGettingLocation || isQuotingDelivery}>
                          <Navigation size={14} /> {isGettingLocation || isQuotingDelivery ? 'Calculando...' : 'Usar ubicación'}
                        </Button>
                      )}
                    </div>
                    {values.deliveryMapsUrl ? (
                      <a href={values.deliveryMapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[11px] font-bold text-central-orange transition-colors duration-200 hover:text-central-cream sm:mt-3 sm:text-xs">
                        Ver ubicación en Google Maps
                      </a>
                    ) : null}
                  </div>
                  {errors.customerLocation ? <p className="mt-1 text-xs text-red-300">{errors.customerLocation}</p> : null}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-white/80 sm:mb-3 sm:text-sm">Método de pago<RequiredMark /></label>
              {activePaymentMethods.length ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {activePaymentMethods.map((method) => (
                    <label key={method.id} className={cn('flex cursor-pointer items-center gap-2 rounded-sm border p-3 text-xs font-bold transition-[border-color,background-color,color,transform] duration-200 ease-out active:scale-[.99] motion-reduce:transition-none sm:gap-3 sm:p-4 sm:text-sm', values.paymentMethod === method.type ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 bg-white/[.035] text-white/70 hover:border-central-orange/50')}>
                      <input type="radio" className="accent-central-orange" checked={values.paymentMethod === method.type} onChange={() => update('paymentMethod', method.type)} /> {method.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-sm border border-red-400/30 bg-red-500/10 p-3 text-xs font-bold text-red-200">No hay métodos de pago habilitados. Contactá al local.</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-white/80 sm:mb-2 sm:text-sm">Observaciones</label>
              <Textarea className="min-h-20 sm:min-h-24" enterKeyHint="done" value={values.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Alguna aclaración general del pedido..." />
            </div>
          </div>

          <aside className="rounded-sm border border-white/10 bg-[#24211f] p-4 lg:sticky lg:top-0 lg:self-start lg:p-5">
            <p className="text-base font-black text-white sm:text-lg">Resumen</p>
            <div className="mt-3 space-y-2 text-xs text-white/65 sm:mt-4 sm:space-y-3 sm:text-sm">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span>{item.quantity} x {item.productName}</span>
                  <strong className="text-white">{formatCurrency(item.quantity * item.unitPrice)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4 text-xs sm:mt-5 sm:pt-5 sm:text-sm">
              <div className="flex justify-between text-white/65"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {isDelivery ? (
                <div className="mt-2 flex justify-between text-white/65"><span>Envío</span><span>{hasValidDeliveryQuote ? formatCurrency(values.deliveryCost ?? 0) : '—'}</span></div>
              ) : null}
              <div className="mt-3 flex justify-between text-base font-black text-white sm:mt-4 sm:text-lg"><span>Total</span><span className="text-central-orange">{formatCurrency(totals.total)}</span></div>
            </div>
            {isDelivery && !hasValidDeliveryQuote ? <p className="mt-3 text-[10px] leading-4 text-white/45 sm:mt-5 sm:text-xs sm:leading-5">Compartí tu ubicación GPS para calcular el envío y obtener el total final.</p> : null}
            {values.paymentMethod === 'transferencia' ? <p className="mt-2 text-[10px] leading-4 text-white/45 sm:mt-3 sm:text-xs sm:leading-5">Los datos de transferencia se enviarán automáticamente en el mensaje de WhatsApp.</p> : null}
            <Button size="sm" className="mt-4 w-full rounded-sm sm:mt-5 sm:h-11" disabled={!canSendOrder} onClick={() => setConfirmSendOpen(true)}>{isSubmitting ? 'Creando pedido...' : 'Enviar a WhatsApp'}</Button>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmSendOpen}
        title="Confirmar pedido"
        description="¿Seguro que querés crear el pedido y abrir WhatsApp con el detalle?"
        confirmLabel="Crear y enviar"
        isLoading={isSubmitting}
        onCancel={() => setConfirmSendOpen(false)}
        onConfirm={handleSubmit}
      />
    </Modal>
  );
}
