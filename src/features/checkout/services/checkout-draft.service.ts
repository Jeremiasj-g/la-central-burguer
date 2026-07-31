import type { CheckoutFormValues } from '../types/checkout.types';
import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from '@/shared/utils/storage.utils';

const CHECKOUT_DRAFT_KEY = 'central_checkout_draft_v1';
const CHECKOUT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CheckoutDraftEnvelope {
  version: 1;
  savedAt: number;
  values: Partial<CheckoutFormValues>;
}

export const EMPTY_CHECKOUT_VALUES: CheckoutFormValues = {
  customerName: '',
  customerPhone: '',
  deliveryMethod: 'delivery',
  address: '',
  customerLocation: null,
  deliveryDistanceKm: undefined,
  deliveryCost: undefined,
  deliveryMapsUrl: undefined,
  paymentMethod: 'efectivo',
  notes: '',
};

function normalizeDraft(values: Partial<CheckoutFormValues>): CheckoutFormValues {
  return {
    ...EMPTY_CHECKOUT_VALUES,
    ...values,
    customerLocation: values.customerLocation ?? null,
  };
}

export function getCheckoutDraft(): CheckoutFormValues {
  const stored = readLocalStorage<CheckoutDraftEnvelope | Partial<CheckoutFormValues> | null>(
    CHECKOUT_DRAFT_KEY,
    null,
  );

  if (!stored) return EMPTY_CHECKOUT_VALUES;

  if ('version' in stored) {
    if (stored.version !== 1 || !('values' in stored)) {
      clearCheckoutDraft();
      return EMPTY_CHECKOUT_VALUES;
    }

    if (Date.now() - stored.savedAt > CHECKOUT_DRAFT_MAX_AGE_MS) {
      clearCheckoutDraft();
      return EMPTY_CHECKOUT_VALUES;
    }

    return normalizeDraft(stored.values);
  }

  // Compatibilidad con el primer formato del borrador, que guardaba el objeto directo.
  return normalizeDraft(stored);
}

export function saveCheckoutDraft(values: CheckoutFormValues) {
  const envelope: CheckoutDraftEnvelope = {
    version: 1,
    savedAt: Date.now(),
    values,
  };
  writeLocalStorage(CHECKOUT_DRAFT_KEY, envelope);
}

export function clearCheckoutDraft() {
  removeLocalStorage(CHECKOUT_DRAFT_KEY);
}
