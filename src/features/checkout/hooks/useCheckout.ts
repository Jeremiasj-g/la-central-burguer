'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { CartItem } from '@/features/carrito/types/carrito.types';
import type { Order } from '@/features/pedidos/types/pedido.types';
import type { CheckoutFormValues } from '../types/checkout.types';
import {
  buildWhatsappUrl,
  createCheckoutOrder,
  validateCheckout,
} from '../services/checkout.service';
import { clearCart } from '@/features/carrito/services/carrito.service';
import { clearCheckoutDraft } from '../services/checkout-draft.service';

export function useCheckout() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFormValues, string>>>({});
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  function clearError(key: keyof CheckoutFormValues) {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(values: CheckoutFormValues, items: CartItem[]) {
    const validation = validateCheckout(values);
    setErrors(validation);

    if (Object.keys(validation).length > 0) {
      toast.warning('Revisá los datos del pedido antes de enviar.');
      return null;
    }

    try {
      setIsSubmitting(true);
      const order = await createCheckoutOrder(values, items);
      const whatsappUrl = await buildWhatsappUrl(order);

      setCreatedOrder(order);
      clearCart();
      clearCheckoutDraft();
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      toast.success('Pedido confirmado. Gracias por tu compra.');
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el pedido.';
      toast.error(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    isSubmitting,
    errors,
    createdOrder,
    submit,
    setCreatedOrder,
    clearError,
  };
}
