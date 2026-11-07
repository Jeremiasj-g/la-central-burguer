import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';

export type PaymentMethod = 'efectivo' | 'transferencia';
export type PaymentPreference = PaymentMethod | 'mixto';
export type PaymentMovementType = 'receipt' | 'reversal' | 'refund';

export interface PaymentMovement {
  id: string;
  method: PaymentMethod;
  amount: number;
  movementType: PaymentMovementType;
  source: 'admin' | 'counter' | 'driver';
  assignmentId: string | null;
  reversedPaymentId: string | null;
  actorId: string | null;
  confirmedAt: string;
  note: string | null;
}

export interface OrderPaymentDetail {
  orderId: string;
  orderCode: string;
  total: number;
  status: string;
  deliveryMethod: 'retiro_local' | 'delivery';
  trackingEnabled: boolean;
  preference: PaymentPreference;
  transferExpected: number | null;
  transferConfirmed: number;
  cashConfirmed: number;
  remaining: number;
  requiresRefund: boolean;
  movements: PaymentMovement[];
  issues: Array<{ id: string; details: string; status: string; createdAt: string }>;
}

type RpcInvoker = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

async function paymentRpc(name: string, args: Record<string, unknown>): Promise<OrderPaymentDetail> {
  requireSupabaseConfigured('gestionar cobros');
  const client = getSupabaseBrowserClient();
  const { data, error } = await (client.rpc.bind(client) as unknown as RpcInvoker)(name, args);
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('No se pudo recuperar la información del cobro.');
  }
  return data as OrderPaymentDetail;
}

export async function getOrderPaymentDetail(orderId: string) {
  return paymentRpc('admin_order_payment_detail', { target_order_id: orderId });
}

export async function saveOrderPaymentPlan(orderId: string, transferAmount: number) {
  return paymentRpc('admin_set_order_payment_plan', {
    target_order_id: orderId,
    transfer_amount: transferAmount,
  });
}

export async function confirmOrderPayment(
  orderId: string, method: PaymentMethod, amount: number, requestId: string,
  note = '',
) {
  return paymentRpc('admin_register_order_payment', {
    target_order_id: orderId,
    payment_method: method,
    payment_amount: amount,
    request_token: requestId,
    payment_note: note,
  });
}

export async function reverseOrderPayment(paymentId: string, reason: string, requestId: string) {
  return paymentRpc('admin_reverse_order_payment', {
    target_payment_id: paymentId,
    reason,
    request_token: requestId,
  });
}

/** Una única representación monetaria para vistas operativas y reportes. */
export function paymentAmounts(detail: OrderPaymentDetail) {
  const confirmed = detail.cashConfirmed + detail.transferConfirmed;
  return {
    confirmed,
    remaining: Math.max(0, detail.total - confirmed),
    expectedCash: detail.transferExpected === null ? null : Math.max(0, detail.total - detail.transferExpected),
    transferRemaining: detail.transferExpected === null ? null
      : Math.max(0, detail.transferExpected - detail.transferConfirmed),
  };
}

/** Reporte: consultar movimientos autorizados en lotes, sin mezclar legados con cobros reales. */
export async function getPaymentMovementsForOrders(orderIds: string[]) {
  if (!orderIds.length) return [];
  requireSupabaseConfigured('consultar movimientos de cobro');
  const client = getSupabaseBrowserClient();
  const all: Array<{ order_id: string; method: PaymentMethod; amount: number; movement_type: PaymentMovementType; source: string; assignment_id: string | null; confirmed_at: string; id: string }> = [];
  for (let index = 0; index < orderIds.length; index += 150) {
    const { data, error } = await client.from('order_payment_movements')
      .select('id,order_id,method,amount,movement_type,source,assignment_id,confirmed_at')
      .in('order_id', orderIds.slice(index, index + 150))
      .order('confirmed_at');
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
  }
  return all;
}
