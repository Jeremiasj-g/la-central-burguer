import { z } from 'zod';

export const ingredienteSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.'),
  type: z.string().min(1, 'Seleccioná un tipo.'),
  unit: z.string().min(1, 'Seleccioná una unidad.'),
});

export type IngredienteSchema = z.infer<typeof ingredienteSchema>;
