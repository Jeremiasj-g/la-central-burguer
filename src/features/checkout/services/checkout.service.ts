import type { CheckoutFormValues } from '../types/checkout.types';
import type { Order } from '@/features/pedidos/types/pedido.types';
import type { CartItem } from '@/features/carrito/types/carrito.types';
import { getBusinessConfig } from '@/features/configuracion/services/configuracion.service';
import { createPublicPedido } from '@/features/pedidos/services/pedidos.service';
import { formatCurrency } from '@/shared/utils/format.utils';
import { formatDistanceKm } from '@/features/delivery/utils/delivery.utils';

export function validateCheckout(values: CheckoutFormValues) {
  const errors: Partial<Record<keyof CheckoutFormValues, string>> = {};

  if (!values.customerName.trim()) errors.customerName = 'Ingresá tu nombre.';
  if (!values.customerPhone.trim()) errors.customerPhone = 'Ingresá tu WhatsApp.';
  if (values.deliveryMethod === 'delivery' && !values.address?.trim() && !values.customerLocation) {
    errors.address = 'Ingresá la dirección o adjuntá tu ubicación actual.';
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
    address: values.address ?? '',
    customerLat: values.customerLocation?.lat ?? null,
    customerLng: values.customerLocation?.lng ?? null,
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
    order.address ? `*Dirección de entrega:* ${order.address}` : '',
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
    order.deliveryMethod === 'delivery' && order.deliveryCost > 0
      ? `*Envío estimado:* ${formatCurrency(order.deliveryCost)}`
      : '*Envío:* A confirmar',
    order.deliveryMethod === 'delivery' && order.deliveryCost > 0
      ? `*Total estimado:* ${formatCurrency(order.total)}`
      : `*Total sin envío:* ${formatCurrency(order.total)}`,
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
