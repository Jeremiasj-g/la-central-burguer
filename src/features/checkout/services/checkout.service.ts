import type { CheckoutFormValues } from '../types/checkout.types';
import type { Order } from '@/features/pedidos/types/pedido.types';
import type { CartItem } from '@/features/carrito/types/carrito.types';
import { getBusinessConfig } from '@/features/configuracion/services/configuracion.service';
import { createPublicPedido } from '@/features/pedidos/services/pedidos.service';
import { formatCurrency } from '@/shared/utils/format.utils';
import { formatDistanceKm } from '@/features/delivery/utils/delivery.utils';

function hasValidDeliveryQuote(values: CheckoutFormValues) {
  return Boolean(
    values.customerLocation
      && typeof values.deliveryDistanceKm === 'number'
      && Number.isFinite(values.deliveryDistanceKm)
      && values.deliveryDistanceKm >= 0
      && typeof values.deliveryCost === 'number'
      && Number.isFinite(values.deliveryCost)
      && values.deliveryCost >= 0
      && values.deliveryMapsUrl,
  );
}

export function validateCheckout(values: CheckoutFormValues) {
  const errors: Partial<Record<keyof CheckoutFormValues, string>> = {};

  if (!values.customerName.trim()) errors.customerName = 'Ingresá tu nombre.';
  if (!values.customerPhone.trim()) errors.customerPhone = 'Ingresá tu WhatsApp.';

  if (values.deliveryMethod === 'delivery') {
    if (!values.customerLocation) {
      errors.customerLocation = 'Para solicitar delivery, compartí tu ubicación GPS.';
    } else if (!hasValidDeliveryQuote(values)) {
      errors.customerLocation = 'No pudimos calcular un envío válido para esta ubicación. Volvé a compartir tu GPS.';
    }
  }

  return errors;
}

export async function createCheckoutOrder(
  values: CheckoutFormValues,
  items: CartItem[],
): Promise<Order> {
  return createPublicPedido({
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    deliveryMethod: values.deliveryMethod,
    address: '',
    customerLat: values.customerLocation?.lat ?? null,
    customerLng: values.customerLocation?.lng ?? null,
    expectedDeliveryCost: values.deliveryMethod === 'delivery' ? values.deliveryCost ?? null : null,
    paymentMethod: values.paymentMethod,
    notes: values.notes ?? '',
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      note: item.note ?? '',
    })),
  });
}

export async function buildWhatsappUrl(order: Order) {
  const config = await getBusinessConfig();
  const whatsappNumber = config.whatsappNumber.replace(/\D/g, '');
  const paymentLabel = order.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo';
  const deliveryLabel = order.deliveryMethod === 'delivery' ? 'Envío a domicilio' : 'Retiro en local';

  const lines = [
    `*Nuevo Pedido - ${config.businessName}*`,
    '------------------------------',
    `*Código de pedido:* ${order.orderCode}`,
    `*Cliente:* ${order.customerName}`,
    `*Teléfono:* ${order.customerPhone}`,
    `*Entrega:* ${deliveryLabel}`,
    order.deliveryMapsUrl ? `*Ubicación adjunta:* ${order.deliveryMapsUrl}` : '',
    typeof order.deliveryDistanceKm === 'number'
      ? `*Distancia aprox.:* ${formatDistanceKm(order.deliveryDistanceKm)}`
      : '',
    `*Método de pago:* ${paymentLabel}`,
    '------------------------------',
    '*Pedido:*',
    ...order.items.map((item) => {
      const note = item.note ? `\n  _Aclaración:_ ${item.note}` : '';
      return `• ${item.quantity} x ${item.productName} (${formatCurrency(item.unitPrice)})${note}`;
    }),
    '------------------------------',
    `*Subtotal:* ${formatCurrency(order.subtotal)}`,
    order.deliveryMethod === 'delivery' ? `*Envío:* ${formatCurrency(order.deliveryCost)}` : '',
    `*Total:* ${formatCurrency(order.total)}`,
    order.notes ? '------------------------------' : '',
    order.notes ? `*Observaciones:* ${order.notes}` : '',
    order.paymentMethod === 'transferencia' ? '------------------------------' : '',
    order.paymentMethod === 'transferencia' ? '*Elegiste método de pago transferencia.*' : '',
    order.paymentMethod === 'transferencia'
      ? 'A continuación te brindamos los datos para realizar el pago:'
      : '',
    order.paymentMethod === 'transferencia' ? `*Alias:* ${config.transferAlias}` : '',
    order.paymentMethod === 'transferencia' ? `*CVU:* ${config.transferCvu}` : '',
  ].filter(Boolean);

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
}
