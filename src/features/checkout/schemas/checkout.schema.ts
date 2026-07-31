import { z } from 'zod';

export const checkoutSchema = z.object({
  customerName: z.string().min(2, 'Ingresá tu nombre.'),
  customerPhone: z.string().min(6, 'Ingresá tu WhatsApp.'),
  deliveryMethod: z.enum(['retiro_local', 'delivery']),
  address: z.string().optional(),
  customerLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }).nullable().optional(),
  paymentMethod: z.enum(['efectivo', 'transferencia']),
  notes: z.string().optional(),
}).superRefine((values, context) => {
  if (values.deliveryMethod === 'delivery' && !values.address?.trim() && !values.customerLocation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message: 'Ingresá la dirección o adjuntá tu ubicación actual.',
    });
  }
});
