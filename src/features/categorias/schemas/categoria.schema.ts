import { z } from 'zod';

export const categoriaSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.'),
  description: z.string().optional(),
  order: z.coerce.number().min(1, 'El orden debe ser mayor a cero.'),
});

export type CategoriaSchema = z.infer<typeof categoriaSchema>;
