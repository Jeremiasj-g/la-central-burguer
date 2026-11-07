export type PaymentPreference = 'efectivo' | 'transferencia' | 'combinado';
export type PaymentMethod = 'efectivo' | 'transferencia';
export type PaymentMovementKind = 'payment' | 'reversal' | 'refund';

export interface PaymentBreakdown {
  total: number;
  transfer: number;
  cash: number;
}

export interface ConfirmedPaymentMovement {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  kind: PaymentMovementKind;
  confirmedAt: string;
  source: 'admin' | 'counter' | 'delivery';
  relatedMovementId?: string | null;
  reason?: string | null;
  confirmedBy?: string | null;
}
