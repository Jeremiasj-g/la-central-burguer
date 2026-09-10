import { z } from 'zod';

export const checkoutSchema = z.object({
  customerName: z.string().min(2, 'Ingresá tu nombre.'),
  customerPhone: z.string().min(6, 'Ingresá tu WhatsApp.'),
  deliveryMethod: z.enum(['retiro_local', 'delivery']),
  address: z.string().optional(),
  customerLocation: z.object({
    lat: z.number().finite(),
    lng: z.number().finite(),
  }).nullable().optional(),
  deliveryDistanceKm: z.number().finite().nonnegative().optional(),
  deliveryCost: z.number().finite().nonnegative().optional(),
  deliveryMapsUrl: z.string().url().optional(),
  paymentMethod: z.enum(['efectivo', 'transferencia']),
  notes: z.string().optional(),
}).superRefine((values, context) => {
  if (values.deliveryMethod !== 'delivery') return;

  if (!values.customerLocation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customerLocation'],
      message: 'Para solicitar delivery, compartí tu ubicación GPS.',
    });
    return;
  }

  if (
    typeof values.deliveryDistanceKm !== 'number'
    || typeof values.deliveryCost !== 'number'
    || !values.deliveryMapsUrl
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customerLocation'],
      message: 'No pudimos calcular un envío válido para esta ubicación. Volvé a compartir tu GPS.',
    });
  }
});
