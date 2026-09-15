import { z } from 'zod';

export const ingredienteSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.'),
  type: z.string().min(1, 'Seleccioná un tipo.'),
  unit: z.string().min(1, 'Seleccioná una unidad.'),
  unitCost: z.number().min(0, 'El costo no puede ser negativo.'),
});

export type IngredienteSchema = z.infer<typeof ingredienteSchema>;
