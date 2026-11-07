import type { ConfirmedPaymentMovement, PaymentBreakdown } from '../types/payment.types';

/** Monetary values are represented in integer cents to avoid floating-point drift. */
export function toCents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('El importe debe ser un número positivo o cero.');
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('El importe supera el límite permitido.');
  return cents;
}

export function splitPayment(total: number, transfer: number): PaymentBreakdown {
  const totalCents = toCents(total);
  const transferCents = toCents(transfer);
  if (transferCents > totalCents) throw new Error('La transferencia no puede superar el total.');
  return { total: totalCents / 100, transfer: transferCents / 100, cash: (totalCents - transferCents) / 100 };
}

export function summarizeConfirmedPayments(total: number, movements: ConfirmedPaymentMovement[]) {
  const totalCents = toCents(total);
  let cashCents = 0;
  let transferCents = 0;
  for (const movement of movements) {
    const cents = toCents(movement.amount) * (movement.kind === 'payment' ? 1 : -1);
    if (movement.method === 'efectivo') cashCents += cents;
    else transferCents += cents;
  }
  const receivedCents = cashCents + transferCents;
  return {
    total: totalCents / 100,
    cash: cashCents / 100,
    transfer: transferCents / 100,
    received: receivedCents / 100,
    pending: Math.max(0, totalCents - receivedCents) / 100,
    overpaid: Math.max(0, receivedCents - totalCents) / 100,
    status: receivedCents <= 0 ? 'sin_cobrar' : receivedCents < totalCents ? 'parcial' : receivedCents === totalCents ? 'cobrado' : 'excedente',
  } as const;
}
