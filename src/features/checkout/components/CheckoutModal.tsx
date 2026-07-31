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
  const totals = useMemo(
    () => calculateCartTotals(items, values.deliveryMethod === 'delivery' ? values.deliveryCost ?? 0 : 0),
    [items, values.deliveryCost, values.deliveryMethod],
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
    clearError('address');
    if (method === 'retiro_local') {
      clearLocation();
      setDeliveryQuote(null);
      setValues((current) => ({
        ...current,
        deliveryMethod: method,
        customerLocation: null,
        deliveryDistanceKm: undefined,
        deliveryCost: undefined,
        deliveryMapsUrl: undefined,
      }));
      return;
    }

    setValues((current) => ({ ...current, deliveryMethod: method }));
  }

  async function attachCurrentLocation() {
    const location = await requestLocation();
    if (!location) return;

    clearError('address');
    setIsQuotingDelivery(true);
    try {
      const quote = await getDeliveryQuote(location);
      if (!quote) {
        toast.warning('Ubicación del local no configurada. El envío queda a confirmar.');
        setDeliveryQuote(null);
        setValues((current) => ({
          ...current,
          customerLocation: location,
          deliveryDistanceKm: undefined,
          deliveryCost: undefined,
          deliveryMapsUrl: undefined,
        }));
        return;
      }

      setDeliveryQuote(quote);
      setValues((current) => ({
        ...current,
        customerLocation: location,
        deliveryDistanceKm: quote.distanceKm,
        deliveryCost: quote.isWithinRange ? quote.deliveryCost : undefined,
        deliveryMapsUrl: quote.mapsUrl,
      }));

      if (!quote.isWithinRange) {
        toast.warning('La ubicación parece estar fuera del radio de entrega. El local puede confirmarlo por WhatsApp.');
      }
    } finally {
      setIsQuotingDelivery(false);
    }
  }

  function removeLocation() {
    clearLocation();
    setDeliveryQuote(null);
    setValues((current) => ({
      ...current,
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
      ? `Distancia aproximada: ${formatDistanceKm(deliveryQuote.distanceKm)} · Envío estimado: ${formatCurrency(deliveryQuote.deliveryCost)}`
      : `Distancia aproximada: ${formatDistanceKm(deliveryQuote.distanceKm)} · Fuera del radio configurado, el envío queda a confirmar.`
    : values.customerLocation
      ? 'Ubicación adjuntada. La dirección escrita deja de ser obligatoria.'
      : 'Podés adjuntar tu ubicación para estimar el costo de envío.';

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
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-sm border p-3 text-xs font-bold transition sm:gap-3 sm:p-4 sm:text-sm', values.deliveryMethod === 'delivery' ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 bg-white/[.035] text-white/70 hover:border-central-orange/50')}>
                  <input type="radio" className="accent-central-orange" checked={values.deliveryMethod === 'delivery'} onChange={() => setDeliveryMethod('delivery')} /> Envío
                </label>
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-sm border p-3 text-xs font-bold transition sm:gap-3 sm:p-4 sm:text-sm', values.deliveryMethod === 'retiro_local' ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 bg-white/[.035] text-white/70 hover:border-central-orange/50')}>
                  <input type="radio" className="accent-central-orange" checked={values.deliveryMethod === 'retiro_local'} onChange={() => setDeliveryMethod('retiro_local')} /> Retiro
                </label>
              </div>
            </div>

            {values.deliveryMethod === 'delivery' ? (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-white/80 sm:mb-2 sm:text-sm">
                  Dirección de entrega{!values.customerLocation ? <RequiredMark /> : null}
                </label>
                <Input
                  autoComplete="street-address"
                  enterKeyHint="next"
                  value={values.address}
                  onChange={(event) => update('address', event.target.value)}
                  placeholder={values.customerLocation ? 'Opcional: calle, número o referencia' : 'Calle, número, depto, referencia, etc.'}
                />
                {errors.address ? <p className="mt-1 text-xs text-red-300">{errors.address}</p> : null}
                <div className="mt-2 rounded-sm border border-white/10 bg-white/[.035] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-xs font-black text-white sm:text-sm"><MapPin size={15} className="text-central-orange" /> Ubicación GPS</p>
                      <p className="mt-1 text-[11px] leading-4 text-white/50 sm:text-xs sm:leading-5">{deliveryHelperText}</p>
                    </div>
                    {values.customerLocation ? (
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-white/70 hover:bg-white/10" title="Quitar ubicación adjunta" onClick={removeLocation}>
                        <XCircle size={14} /> Quitar
                      </Button>
                    ) : (
                      <Button type="button" variant="secondary" size="sm" className="h-8 px-2 text-xs" title="Adjuntar ubicación actual" onClick={attachCurrentLocation} disabled={isGettingLocation || isQuotingDelivery}>
                        <Navigation size={14} /> {isGettingLocation || isQuotingDelivery ? 'Calculando...' : 'Usar ubicación'}
                      </Button>
                    )}
                  </div>
                  {values.deliveryMapsUrl ? (
                    <a href={values.deliveryMapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[11px] font-bold text-central-orange hover:text-central-cream sm:mt-3 sm:text-xs">
                      Ver ubicación en Google Maps
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-xs font-bold text-white/80 sm:mb-3 sm:text-sm">Método de pago<RequiredMark /></label>
              {activePaymentMethods.length ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {activePaymentMethods.map((method) => (
                    <label key={method.id} className={cn('flex cursor-pointer items-center gap-2 rounded-sm border p-3 text-xs font-bold transition sm:gap-3 sm:p-4 sm:text-sm', values.paymentMethod === method.type ? 'border-central-orange bg-central-orange/12 text-central-cream' : 'border-white/10 bg-white/[.035] text-white/70 hover:border-central-orange/50')}>
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
              <div className="mt-2 flex justify-between text-white/65"><span>Envío</span><span>{values.deliveryMethod === 'delivery' && values.deliveryCost ? formatCurrency(values.deliveryCost) : 'A confirmar'}</span></div>
              <div className="mt-3 flex justify-between text-base font-black text-white sm:mt-4 sm:text-lg"><span>{values.deliveryMethod === 'delivery' && values.deliveryCost ? 'Total estimado' : 'Total sin envío'}</span><span className="text-central-orange">{formatCurrency(totals.total)}</span></div>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-white/45 sm:mt-5 sm:text-xs sm:leading-5">El costo de envío se estima por distancia y puede ser confirmado por WhatsApp.</p>
            {values.paymentMethod === 'transferencia' ? <p className="mt-2 text-[10px] leading-4 text-white/45 sm:mt-3 sm:text-xs sm:leading-5">Los datos de transferencia se enviarán automáticamente en el mensaje de WhatsApp.</p> : null}
            <Button size="sm" className="mt-4 w-full rounded-sm sm:mt-5 sm:h-11" disabled={isSubmitting || items.length === 0 || activePaymentMethods.length === 0} onClick={() => setConfirmSendOpen(true)}>{isSubmitting ? 'Creando pedido...' : 'Enviar a WhatsApp'}</Button>
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
