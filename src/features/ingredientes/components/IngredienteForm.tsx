'use client';

import { useState } from 'react';
import type { Ingredient } from '../types/ingrediente.types';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';

const INGREDIENT_TYPE_OPTIONS = [
  { value: 'proteina', label: 'Proteína' },
  { value: 'panificados', label: 'Panificados' },
  { value: 'lacteos', label: 'Lácteos' },
  { value: 'verduras', label: 'Verduras' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'otros', label: 'Otros' },
] as const;

const INGREDIENT_UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'gr', label: 'gr' },
  { value: 'unidad', label: 'unidad' },
  { value: 'litro', label: 'litro' },
  { value: 'ml', label: 'ml' },
  { value: 'paquete', label: 'paquete' },
] as const;

type IngredientFormValues = {
  name: string;
  type: Ingredient['type'];
  unit: Ingredient['unit'];
  unitCost: number;
  supplier?: string;
  active: boolean;
};

export function IngredienteForm({ ingredient, isSaving, onSubmit, onCancel }: { ingredient?: Ingredient | null; isSaving?: boolean; onSubmit: (values: IngredientFormValues) => void; onCancel: () => void }) {
  const [values, setValues] = useState<IngredientFormValues>({
    name: ingredient?.name ?? '',
    type: ingredient?.type ?? 'otros',
    unit: ingredient?.unit ?? 'unidad',
    unitCost: ingredient?.unitCost ?? 0,
    supplier: ingredient?.supplier ?? '',
    active: ingredient?.active ?? true,
  });

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
      <div className="admin-modal-field">
        <label className="admin-modal-label">Nombre</label>
        <Input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="admin-modal-field">
          <label className="admin-modal-label">Tipo</label>
          <Select
            aria-label="Tipo de ingrediente"
            value={values.type}
            options={INGREDIENT_TYPE_OPTIONS}
            onValueChange={(type) => setValues({ ...values, type: type as Ingredient['type'] })}
          />
        </div>
        <div className="admin-modal-field">
          <label className="admin-modal-label">Unidad base</label>
          <Select
            aria-label="Unidad de medida"
            value={values.unit}
            options={INGREDIENT_UNIT_OPTIONS}
            onValueChange={(unit) => setValues({ ...values, unit: unit as Ingredient['unit'] })}
          />
        </div>
      </div>
      <div className="admin-modal-field">
        <label className="admin-modal-label">Costo por {values.unit}</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={values.unitCost}
          onChange={(event) => setValues({ ...values, unitCost: Number(event.target.value) })}
          required
        />
        <p className="mt-1.5 text-xs leading-5 text-white/45">Este valor se usa para calcular automáticamente el costo de cada receta y su rentabilidad.</p>
      </div>
      <div className="admin-modal-field">
        <label className="admin-modal-label">Proveedor</label>
        <Input value={values.supplier} onChange={(event) => setValues({ ...values, supplier: event.target.value })} placeholder="Opcional" />
      </div>
      <div className="admin-modal-field">
        <span className="admin-modal-label">Estado</span>
        <label className="flex items-center gap-3 rounded-sm border border-white/10 bg-white/[.04] p-3 text-sm font-bold text-white/85">
          <input type="checkbox" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} /> Activo
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
        <Button type="button" variant="dark" className="rounded-sm bg-white/10 hover:bg-white/15" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="rounded-sm" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar ingrediente'}</Button>
      </div>
    </form>
  );
}
