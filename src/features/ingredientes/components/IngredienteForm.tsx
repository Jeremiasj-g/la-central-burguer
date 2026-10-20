'use client';

import { useState } from 'react';
import type { Ingredient } from '../types/ingrediente.types';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { formatCurrency } from '@/shared/utils/format.utils';

const labelClass = 'mb-1.5 block text-[11px] font-medium text-neutral-500';
const inputClass = '!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !text-[13px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10';

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

type IngredientFormValues = { name: string; type: Ingredient['type']; unit: Ingredient['unit']; unitCost: number; supplier?: string; active: boolean };
export function IngredienteForm({ ingredient, isSaving, onSubmit, onCancel }: { ingredient?: Ingredient | null; isSaving?: boolean; onSubmit: (values: IngredientFormValues) => void; onCancel: () => void }) {
  const [values, setValues] = useState<IngredientFormValues>({ name: ingredient?.name ?? '', type: ingredient?.type ?? 'otros', unit: ingredient?.unit ?? 'unidad', unitCost: ingredient?.unitCost ?? 0, supplier: ingredient?.supplier ?? '', active: ingredient?.active ?? true });

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (Number.isFinite(values.unitCost) && values.unitCost >= 0) onSubmit(values); }}>
      <div>
        <label htmlFor="ingredient-name" className={labelClass}>Nombre del ingrediente</label>
        <Input id="ingredient-name" className={inputClass} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ej. Pan de hamburguesa" required />
      </div>
      <div>
        <label htmlFor="ingredient-supplier" className={labelClass}>Proveedor</label>
        <Input id="ingredient-supplier" className={inputClass} value={values.supplier} onChange={(event) => setValues({ ...values, supplier: event.target.value })} placeholder="Opcional" />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <span className={labelClass}>Tipo de ingrediente</span>
          <Select
            aria-label="Tipo de ingrediente"
            variant="light"
            value={values.type}
            options={INGREDIENT_TYPE_OPTIONS}
            onValueChange={(type) => setValues({ ...values, type: type as Ingredient['type'] })}
            className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !text-[12px] !font-normal !shadow-none"
            contentClassName="!rounded-[13px]"
          />
        </div>
        <div className="min-w-0">
          <span className={labelClass}>Unidad de medida</span>
          <Select
            aria-label="Unidad de medida"
            variant="light"
            value={values.unit}
            options={INGREDIENT_UNIT_OPTIONS}
            onValueChange={(unit) => setValues({ ...values, unit: unit as Ingredient['unit'] })}
            className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !text-[12px] !font-normal !shadow-none"
            contentClassName="!rounded-[13px]"
          />
        </div>
      </div>
      <div className="min-w-0">
        <label htmlFor="ingredient-unit-cost" className={labelClass}>Costo por {values.unit}</label>
        <Input id="ingredient-unit-cost" type="number" min="0" step="0.01" inputMode="decimal" required
          className={inputClass + ' !border-neutral-300 !bg-white hover:!border-neutral-400'}
          value={values.unitCost}
          onChange={(event) => setValues({ ...values, unitCost: Number(event.target.value) })}
        />
        <p className="mt-1.5 text-[11px] leading-5 text-neutral-500">
          Costo por unidad base de compra. {values.unitCost > 0 ? 'Costo actual: ' + formatCurrency(values.unitCost) + ' / ' + values.unit : 'Cargá un costo mayor que cero para completar los análisis de recetas.'}
        </p>
      </div>
      <div className="rounded-[13px] border border-neutral-200/80 bg-[#fafafa] p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-neutral-800">Ingrediente activo</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">Disponible para asociar a nuevos productos.</span>
          </span>
          <input type="checkbox" aria-label="Ingrediente activo" className="h-4 w-4 shrink-0 cursor-pointer accent-central-orange" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} />
        </label>
      </div>
      <div className="flex min-w-0 justify-end gap-2 border-t border-neutral-100 pt-4">
        <Button type="button" variant="secondary" className="!rounded-[11px] !border-neutral-200 !bg-[#f7f7f9] !px-4 !text-[12px] !font-medium !text-neutral-600 !shadow-none hover:!bg-neutral-100" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="!rounded-[11px] !bg-[#191b20] !px-4 !text-[12px] !font-medium !shadow-none hover:!bg-neutral-700" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar ingrediente'}</Button>
      </div>
    </form>
  );
}
