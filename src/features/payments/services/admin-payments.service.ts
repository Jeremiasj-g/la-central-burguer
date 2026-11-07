import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import type { ConfirmedPaymentMovement, PaymentMethod } from '../types/payment.types';
import { summarizeConfirmedPayments } from '../utils/payment.utils';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type PlanRow = Database['public']['Tables']['order_payment_plans']['Row'];
type MovementRow = Database['public']['Tables']['order_payment_movements']['Row'];

export interface AdminOrderPaymentState {
  total: number;
  status: OrderRow['status'];
  deliveryMethod: OrderRow['delivery_method'];
  preference: string;
  legacy: boolean;
  plan: { transfer: number; cash: number } | null;
  movements: ConfirmedPaymentMovement[];
  summary: ReturnType<typeof summarizeConfirmedPayments>;
}

/** Reads only explicit confirmed movements. Historic payment_method is a preference, never evidence of payment. */
export async function getAdminOrderPaymentState(orderId: string): Promise<AdminOrderPaymentState> {
  requireSupabaseConfigured('consultar el cobro');
  const client = getSupabaseBrowserClient();
  const [{ data: order, error: orderError }, { data: plan, error: planError }, { data: rows, error: movementError }] = await Promise.all([
    client.from('orders').select('id,total,status,delivery_method,payment_method,payment_preference').eq('id', orderId).single(),
    client.from('order_payment_plans').select('*').eq('order_id', orderId).maybeSingle(),
    client.from('order_payment_movements').select('*').eq('order_id', orderId).order('confirmed_at', { ascending: false }),
  ]);
  if (orderError) throw new Error(orderError.message);
  if (planError) throw new Error(planError.message);
  if (movementError) throw new Error(movementError.message);
  if (!order) throw new Error('No encontramos el pedido.');
  const legacy = !order.payment_preference;
  const movements: ConfirmedPaymentMovement[] = ((rows ?? []) as MovementRow[]).map(row => ({
    id: row.id,
    orderId: row.order_id,
    method: row.method as PaymentMethod,
    amount: Number(row.amount),
    kind: row.kind as ConfirmedPaymentMovement['kind'],
    confirmedAt: row.confirmed_at,
    source: row.source as ConfirmedPaymentMovement['source'],
    relatedMovementId: row.related_movement_id,
    reason: row.reason,
    confirmedBy: row.confirmed_by,
  }));
  const typedPlan = plan as PlanRow | null;
  return {
    total: Number(order.total),
    status: order.status,
    deliveryMethod: order.delivery_method,
    preference: order.payment_preference || order.payment_method,
    legacy,
    plan: typedPlan ? { transfer: Number(typedPlan.transfer_amount), cash: Number(typedPlan.cash_amount) } : null,
    movements,
    summary: summarizeConfirmedPayments(Number(order.total), movements),
  };
}

export async function setAdminOrderPaymentPlan(orderId: string, transfer: number, cash: number): Promise<void> {
  requireSupabaseConfigured('establecer la distribución de cobro');
  const { error } = await getSupabaseBrowserClient().rpc('admin_set_order_payment_plan', {
    target_order_id: orderId,
    transfer_value: transfer,
    cash_value: cash,
  });
  if (error) throw new Error(error.message);
}

export async function confirmAdminOrderPayment(
  orderId: string,
  method: PaymentMethod,
  amount: number,
  idempotencyKey: string,
): Promise<void> {
  requireSupabaseConfigured('confirmar el cobro');
  const { error } = await getSupabaseBrowserClient().rpc('admin_confirm_order_payment', {
    target_order_id: orderId,
    payment_method: method,
    payment_amount: amount,
    request_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
}

export async function reverseAdminOrderPayment(
  movementId: string,
  reason: string,
  idempotencyKey: string,
): Promise<void> {
  requireSupabaseConfigured('corregir un cobro');
  const { error } = await getSupabaseBrowserClient().rpc('admin_reverse_order_payment', {
    target_movement_id: movementId,
    correction_reason: reason,
    request_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
}

/** Record a full refund only AFTER cash has been returned or bank transfer settled. */
export async function refundAdminOrderPayment(
  movementId: string,
  reason: string,
  idempotencyKey: string,
): Promise<void> {
  requireSupabaseConfigured('registrar un reintegro');
  const { error } = await getSupabaseBrowserClient().rpc('admin_refund_order_payment', {
    target_movement_id: movementId,
    refund_reason: reason,
    request_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
}
