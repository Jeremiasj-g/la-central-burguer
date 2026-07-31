import { z } from 'zod';

export const productoSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.'),
  description: z.string().optional().default(''),
  categoryId: z.string().min(1, 'Seleccioná una categoría.'),
  currentPrice: z.coerce.number().min(1, 'El precio debe ser mayor a cero.'),
  imageUrl: z.string().min(1, 'Ingresá una imagen.'),
  ingredientIds: z.array(z.string()).optional(),
});

export type ProductoSchema = z.infer<typeof productoSchema>;
