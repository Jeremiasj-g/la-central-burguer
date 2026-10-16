'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, CreditCard, MapPin, MessageSquareText, Navigation, ShoppingBag, Store, Truck, UserRound, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import type { CartItem } from '@/features/carrito/types/carrito.types';
import type { CheckoutFormValues } from '../types/checkout.types';
import { useCheckout } from '../hooks/useCheckout';
import { getDeliveryQuote } from '@/features/delivery/services/delivery.service';
import type { DeliveryQuote } from '@/features/delivery/types/delivery.types';
import { formatDistanceKm, formatRouteDuration } from '@/features/delivery/utils/delivery.utils';
import { useCurrentLocation } from '@/features/delivery/hooks/useCurrentLocation';
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

function clearDeliveryQuoteValues(current: CheckoutFormValues): CheckoutFormValues {
  return {
    ...current,
    address: '',
    customerLocation: null,
    deliveryDistanceKm: undefined,
    deliveryStraightDistanceKm: undefined,
    deliveryRouteDurationSeconds: undefined,
    deliveryRouteDurationText: undefined,
    deliveryRouteVia: undefined,
    deliveryRouteProvider: undefined,
    deliveryTravelMode: undefined,
    deliveryCost: undefined,
    deliveryMapsUrl: undefined,
    deliveryQuoteToken: undefined,
    deliveryQuoteExpiresAt: undefined,
  };
}

function isFreshQuote(expiresAt: string | undefined) {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
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
      && values.deliveryQuoteToken
      && isFreshQuote(values.deliveryQuoteExpiresAt)
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
    const canRestoreQuote = Boolean(
      draft.customerLocation
        && typeof draft.deliveryDistanceKm === 'number'
        && typeof draft.deliveryStraightDistanceKm === 'number'
        && draft.deliveryMapsUrl
        && draft.deliveryQuoteToken
        && isFreshQuote(draft.deliveryQuoteExpiresAt),
    );

    if (canRestoreQuote) {
      setValues(draft);
      setDeliveryQuote({
        distanceKm: draft.deliveryDistanceKm!,
        routeDistanceKm: draft.deliveryDistanceKm!,
        straightDistanceKm: draft.deliveryStraightDistanceKm!,
        routeDurationSeconds: draft.deliveryRouteDurationSeconds ?? null,
        routeDurationText: draft.deliveryRouteDurationText ?? null,
        routeVia: draft.deliveryRouteVia ?? null,
        routeProvider: draft.deliveryRouteProvider ?? 'serpapi_google_maps',
        travelMode: draft.deliveryTravelMode ?? 'two_wheeler',
        deliveryCost: draft.deliveryCost ?? 0,
        isWithinRange: typeof draft.deliveryCost === 'number',
        mapsUrl: draft.deliveryMapsUrl!,
        quoteToken: draft.deliveryQuoteToken!,
        quoteExpiresAt: draft.deliveryQuoteExpiresAt!,
      });
    } else {
      setValues(clearDeliveryQuoteValues(draft));
      setDeliveryQuote(null);
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
        ...clearDeliveryQuoteValues(current),
        deliveryMethod: method,
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
        setValues((current) => clearDeliveryQuoteValues(current));
        toast.error('No pudimos calcular el envío. Verificá la ubicación del local e intentá nuevamente.');
        return;
      }

      setDeliveryQuote(quote);
      setValues((current) => ({
        ...current,
        address: '',
        customerLocation: location,
        deliveryDistanceKm: quote.routeDistanceKm,
        deliveryStraightDistanceKm: quote.straightDistanceKm,
        deliveryRouteDurationSeconds: quote.routeDurationSeconds,
        deliveryRouteDurationText: quote.routeDurationText,
        deliveryRouteVia: quote.routeVia,
        deliveryRouteProvider: quote.routeProvider,
        deliveryTravelMode: quote.travelMode,
        deliveryCost: quote.isWithinRange ? quote.deliveryCost : undefined,
        deliveryMapsUrl: quote.mapsUrl,
        deliveryQuoteToken: quote.quoteToken,
        deliveryQuoteExpiresAt: quote.quoteExpiresAt,
      }));

      if (!quote.isWithinRange) {
        toast.warning('Esta ubicación está fuera del radio de entrega configurado.');
      }
    } catch (error) {
      clearLocation();
      setDeliveryQuote(null);
      setValues((current) => clearDeliveryQuoteValues(current));
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
    setValues((current) => clearDeliveryQuoteValues(current));
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
      ? `Ruta en moto: ${formatDistanceKm(deliveryQuote.routeDistanceKm)} · ${formatRouteDuration(deliveryQuote.routeDurationSeconds)} · Envío: ${formatCurrency(deliveryQuote.deliveryCost)}`
      : `Ruta en moto: ${formatDistanceKm(deliveryQuote.routeDistanceKm)} · Fuera del radio de entrega.`
    : 'Para solicitar delivery, activá el GPS y compartí tu ubicación actual. La utilizaremos para calcular el envío y localizar la entrega.';

  const canSendOrder = !isSubmitting
    && items.length > 0
    && activePaymentMethods.length > 0
    && hasValidDeliveryQuote;
  const productCount = items.reduce((count, item) => count + item.quantity, 0);


  return (
    <Modal
      open={open}
      onClose={onClose}
      title={createdOrder ? 'Pedido creado' : 'Finalizá tu pedido'}
      theme="dark"
      size="lg"
      panelClassName="lcb-checkout-panel !max-w-[920px] !rounded-[22px] !border-white/10 !bg-[#171717] !text-[#f6f5f2] max-sm:!max-w-[calc(100vw-1rem)]"
      footer={!createdOrder ? (
        <div className="lcb-checkout-footer flex items-center justify-between gap-3 lg:hidden">
          <div className="min-w-0">
            <p className="text-[10px] leading-4 text-white/45">{hasValidDeliveryQuote ? 'Total del pedido' : 'Subtotal sin envío'}</p>
            <p className="truncate text-[20px] font-semibold leading-6 tracking-[-.045em] tabular-nums text-white">
              {formatCurrency(totals.total)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmSendOpen(true)}
            disabled={!canSendOrder}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-central-orange px-4 text-[12px] font-semibold text-[#191919] transition-[background-color,opacity] duration-200 hover:bg-[#ffc04a] disabled:cursor-not-allowed disabled:opacity-45 sm:px-6"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar pedido'}
            <ArrowRight size={16} strokeWidth={1.9}/>
          </button>
        </div>
      ) : undefined}
      footerClassName="lcb-checkout-modal-footer lg:hidden"
    >
      {createdOrder ? (
        <div className="mx-auto max-w-[520px] px-1 py-5 text-center sm:py-7">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-central-orange/10 text-central-orange">
            <Check size={26} strokeWidth={2}/>
          </div>
          <h3 className="mt-5 text-[23px] font-semibold leading-tight tracking-[-.04em] text-white sm:text-[27px]">¡Pedido confirmado!</h3>
          <p className="mx-auto mt-3 max-w-[400px] text-[13px] leading-[1.7] text-white/55">
            Ya registramos tu pedido en {config?.businessName ?? 'La Central Burger'} y abrimos WhatsApp con el detalle para coordinarlo.
          </p>
          <div className="mt-6 border-y border-white/10 py-5">
            <p className="text-[11px] text-white/45">Código de tu pedido</p>
            <p className="mt-1.5 break-all font-mono text-[19px] font-semibold tracking-[-.02em] text-central-orange sm:text-[23px]">
              {createdOrder.orderCode}
            </p>
          </div>
          <button type="button" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-central-orange text-[13px] font-semibold text-[#191919] transition-colors duration-200 hover:bg-[#ffc04a]"
            onClick={() => { setCreatedOrder(null); onClose(); }}>
            Entendido
          </button>
        </div>
      ) : (
        <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-7">
            <section aria-labelledby="checkout-contact-title">
              <div className="mb-4 flex items-center gap-2">
                <UserRound size={17} strokeWidth={1.8} className="text-central-orange" />
                <h3 id="checkout-contact-title" className="text-[16px] font-semibold tracking-[-.025em] text-white">Tus datos</h3>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="checkout-customer-name" className="mb-2 block text-[12px] font-medium text-white/75">
                    Nombre completo<RequiredMark />
                  </label>
                  <Input id="checkout-customer-name" autoComplete="name" enterKeyHint="next"
                    className="lcb-checkout-input !h-11 !rounded-[12px] !border-white/10 !bg-white/[.045] !px-3.5 !text-[14px] !font-normal !text-white placeholder:!text-white/35"
                    value={values.customerName} onChange={(event) => update('customerName', event.target.value)} placeholder="Tu nombre" />
                  {errors.customerName ? <p className="mt-1.5 text-[11px] text-red-300" role="alert">{errors.customerName}</p> : null}
                </div>
                <div className="min-w-0">
                  <label htmlFor="checkout-customer-phone" className="mb-2 block text-[12px] font-medium text-white/75">
                    Teléfono<RequiredMark />
                  </label>
                  <Input id="checkout-customer-phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next"
                    className="lcb-checkout-input !h-11 !rounded-[12px] !border-white/10 !bg-white/[.045] !px-3.5 !text-[14px] !font-normal !text-white placeholder:!text-white/35"
                    value={values.customerPhone} onChange={(event) => update('customerPhone', event.target.value)} placeholder="Tu número de WhatsApp"/>
                  {errors.customerPhone ? <p className="mt-1.5 text-[11px] text-red-300" role="alert">{errors.customerPhone}</p> : null}
                </div>
              </div>
            </section>

            <section className="border-t border-white/[.085] pt-6" aria-labelledby="checkout-delivery-title">
              <div className="mb-4 flex items-center gap-2">
                <Truck size={17} strokeWidth={1.8} className="text-central-orange"/>
                <h3 id="checkout-delivery-title" className="text-[16px] font-semibold tracking-[-.025em] text-white">¿Cómo recibís tu pedido?</h3>
                <RequiredMark />
              </div>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Opciones de entrega">
                <label className={cn(
                  'lcb-checkout-choice flex cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 py-3 text-[12px] font-medium transition-[border-color,background-color] duration-200 sm:px-4',
                  isDelivery ? 'border-central-orange/75 bg-central-orange/[.09] text-white' : 'border-white/10 bg-white/[.035] text-white/65 hover:border-white/25',
                )}>
                  <input type="radio" name="checkout-delivery-method" className="sr-only" checked={isDelivery} onChange={() => setDeliveryMethod('delivery')}/>
                  <span className={cn('grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border', isDelivery ? 'border-central-orange' : 'border-white/35')}>
                    {isDelivery ? <span className="h-[9px] w-[9px] rounded-full bg-central-orange"/> : null}
                  </span>
                  <Truck size={16} strokeWidth={1.7} className="hidden text-central-orange sm:block"/>
                  Envío a domicilio
                </label>
                <label className={cn(
                  'lcb-checkout-choice flex cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 py-3 text-[12px] font-medium transition-[border-color,background-color] duration-200 sm:px-4',
                  values.deliveryMethod === 'retiro_local' ? 'border-central-orange/75 bg-central-orange/[.09] text-white' : 'border-white/10 bg-white/[.035] text-white/65 hover:border-white/25',
                )}>
                  <input type="radio" name="checkout-delivery-method" className="sr-only" checked={values.deliveryMethod === 'retiro_local'} onChange={() => setDeliveryMethod('retiro_local')}/>
                  <span className={cn('grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border', values.deliveryMethod === 'retiro_local' ? 'border-central-orange' : 'border-white/35')}>
                    {values.deliveryMethod === 'retiro_local' ? <span className="h-[9px] w-[9px] rounded-full bg-central-orange"/> : null}
                  </span>
                  <Store size={16} strokeWidth={1.7} className="hidden text-central-orange sm:block"/>
                  Retiro en local
                </label>
              </div>

              <div aria-hidden={!isDelivery} className={cn(
                'grid transition-[grid-template-rows,opacity,margin-top] duration-200 ease-out motion-reduce:transition-none',
                isDelivery ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0',
              )}>
                <div className="min-h-0 overflow-hidden">
                  <div className={cn(
                    'rounded-[14px] border px-3.5 py-3.5 transition-colors duration-200 sm:px-4',
                    deliveryQuote && !deliveryQuote.isWithinRange ? 'border-red-400/30 bg-red-500/[.04]' : 'border-white/10 bg-white/[.035]',
                  )}>
                    <div className="flex items-start gap-3">
                      <MapPin size={18} strokeWidth={1.85} className="mt-0.5 shrink-0 text-central-orange"/>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-white">
                          {values.customerLocation ? 'Ubicación registrada' : 'Ubicación para el envío'}
                          <RequiredMark/>
                        </p>
                        <p className={cn('mt-1 text-[11px] leading-[1.6]', deliveryQuote && !deliveryQuote.isWithinRange ? 'text-red-200/85' : 'text-white/50')}>
                          {deliveryHelperText}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-[30px]">
                      {values.customerLocation ? (
                        <button type="button" onClick={removeLocation} disabled={!isDelivery}
                          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white/[.075] px-3 text-[11px] font-medium text-white/70 transition-colors duration-200 hover:bg-white/10">
                          <XCircle size={14}/> Quitar ubicación
                        </button>
                      ) : (
                        <button type="button" onClick={attachCurrentLocation} disabled={!isDelivery || isGettingLocation || isQuotingDelivery}
                          className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-central-orange px-3 text-[11px] font-semibold text-[#191919] transition-colors duration-200 hover:bg-[#ffc04a] disabled:cursor-wait disabled:opacity-60">
                          <Navigation size={14} strokeWidth={1.9}/>
                          {isGettingLocation || isQuotingDelivery ? 'Calculando...' : 'Compartir ubicación'}
                        </button>
                      )}
                      {values.deliveryMapsUrl ? (
                        <a href={values.deliveryMapsUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center text-[11px] font-medium text-central-orange hover:underline">
                          Ver en Google Maps
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {errors.customerLocation ? <p className="mt-2 text-[11px] text-red-300" role="alert">{errors.customerLocation}</p> : null}
                </div>
              </div>
            </section>

            <section className="border-t border-white/[.085] pt-6" aria-labelledby="checkout-payment-title">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard size={17} strokeWidth={1.8} className="text-central-orange"/>
                <h3 id="checkout-payment-title" className="text-[16px] font-semibold tracking-[-.025em] text-white">¿Cómo vas a pagar?</h3>
                <RequiredMark/>
              </div>
              {activePaymentMethods.length ? (
                <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Método de pago">
                  {activePaymentMethods.map((method) => (
                    <label key={method.id} className={cn(
                      'lcb-checkout-choice flex min-w-0 cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 py-3 text-[12px] font-medium transition-[border-color,background-color] duration-200 sm:px-4',
                      values.paymentMethod === method.type ? 'border-central-orange/75 bg-central-orange/[.09] text-white' : 'border-white/10 bg-white/[.035] text-white/65 hover:border-white/25',
                    )}>
                      <input type="radio" name="checkout-payment-method" className="sr-only" checked={values.paymentMethod === method.type} onChange={() => update('paymentMethod', method.type)}/>
                      <span className={cn('grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border', values.paymentMethod === method.type ? 'border-central-orange' : 'border-white/35')}>
                        {values.paymentMethod === method.type ? <span className="h-[9px] w-[9px] rounded-full bg-central-orange"/> : null}
                      </span>
                      <span className="min-w-0 break-words">{method.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-[12px] border border-red-400/20 bg-red-500/[.06] p-3 text-[12px] leading-5 text-red-200">
                  No hay métodos de pago habilitados. Contactá al local.
                </p>
              )}
              {values.paymentMethod === 'transferencia' ? (
                <p className="mt-2.5 text-[11px] leading-5 text-white/45">
                  Los datos de transferencia se enviarán automáticamente en el mensaje de WhatsApp.
                </p>
              ) : null}
            </section>

            <section className="border-t border-white/[.085] pt-6" aria-labelledby="checkout-notes-title">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquareText size={17} strokeWidth={1.8} className="text-white/45"/>
                <h3 id="checkout-notes-title" className="text-[14px] font-medium text-white/85">Observaciones</h3>
                <span className="text-[11px] text-white/40">Opcional</span>
              </div>
              <Textarea
                className="lcb-checkout-notes !min-h-[82px] !w-full !rounded-[12px] !border-white/10 !bg-white/[.045] !px-3.5 !py-3 !text-[13px] !font-normal !leading-5 !text-white placeholder:!text-white/35 focus:!border-central-orange/60"
                enterKeyHint="done"
                value={values.notes}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="¿Algo más que debamos saber?"
              />
            </section>
          </div>

          <aside className="lcb-checkout-summary min-w-0 border-t border-white/[.085] pt-5 lg:sticky lg:top-0 lg:border-t-0 lg:pt-0">
            <details className="group lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-medium text-white/70 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><ShoppingBag size={17} className="text-central-orange"/> Ver detalle del pedido ({productCount})</span>
                <ChevronDown size={17} className="transition-transform duration-200 group-open:rotate-180"/>
              </summary>
              <div className="mt-3 space-y-2.5 border-t border-white/[.085] pt-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-[12px] leading-5 text-white/60">
                    <span className="min-w-0">{item.quantity} × {item.productName}</span>
                    <span className="shrink-0 tabular-nums text-white/85">{formatCurrency(item.quantity * item.unitPrice)}</span>
                  </div>
                ))}
              </div>
            </details>
            <div className="hidden lg:block">
              <div className="mb-5 flex items-center gap-2">
                <ShoppingBag size={18} strokeWidth={1.75} className="text-central-orange"/>
                <h3 className="text-[16px] font-semibold tracking-[-.025em] text-white">Tu pedido</h3>
              </div>
              <div className="max-h-[220px] space-y-3 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-[12px] leading-5 text-white/60">
                    <span className="min-w-0">{item.quantity} × {item.productName}</span>
                    <span className="shrink-0 tabular-nums text-white/85">{formatCurrency(item.quantity * item.unitPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 hidden space-y-2.5 border-t border-white/[.085] pt-4 text-[12px] lg:block">
              <div className="flex justify-between text-white/55"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {isDelivery ? (
                <div className="flex justify-between gap-2 text-white/55">
                  <span>Envío</span>
                  <span>{hasValidDeliveryQuote ? formatCurrency(values.deliveryCost ?? 0) : 'Pendiente de GPS'}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-white/[.085] pt-3">
                <span className="text-[13px] font-medium text-white/80">{hasValidDeliveryQuote ? 'Total' : 'Subtotal sin envío'}</span>
                <span className="text-[24px] font-semibold tracking-[-.045em] tabular-nums text-white">{formatCurrency(totals.total)}</span>
              </div>
            </div>
            {isDelivery && !hasValidDeliveryQuote ? (
              <p className="mt-3 text-[11px] leading-5 text-white/45 lg:mt-4">Compartí tu ubicación GPS para calcular el costo de envío antes de confirmar.</p>
            ) : null}
            <button type="button" onClick={() => setConfirmSendOpen(true)} disabled={!canSendOrder}
              className="mt-4 hidden h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-central-orange px-4 text-[13px] font-semibold text-[#191919] transition-colors duration-200 hover:bg-[#ffc04a] disabled:cursor-not-allowed disabled:opacity-45 lg:flex">
              {isSubmitting ? 'Creando pedido...' : 'Enviar a WhatsApp'} <ArrowRight size={17}/>
            </button>
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
