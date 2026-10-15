'use client';

import { useState } from 'react';
import type { Category } from '../types/categoria.types';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Textarea } from '@/shared/components/ui/Textarea';

const labelClass = 'mb-1.5 block text-[11px] font-medium text-neutral-500';
const inputClass = '!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !text-[13px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10';

export function CategoriaForm({ category, isSaving, onSubmit, onCancel }: { category?: Category | null; isSaving?: boolean; onSubmit: (values: { name: string; description?: string; order: number; active: boolean }) => void; onCancel: () => void }) {
  const [values, setValues] = useState({ name: category?.name ?? '', description: category?.description ?? '', order: category?.order ?? 1, active: category?.active ?? true });

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
      <div>
        <label htmlFor="category-name" className={labelClass}>Nombre de la categoría</label>
        <Input id="category-name" className={inputClass} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ej. Hamburguesas" required />
      </div>
      <div>
        <label htmlFor="category-description" className={labelClass}>Descripción</label>
        <Textarea id="category-description" className="!min-h-24 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !py-2.5 !text-[13px] !font-normal !text-neutral-900 placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white focus:!ring-central-orange/10" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Descripción opcional" />
      </div>
      <div>
        <label htmlFor="category-order" className={labelClass}>Orden de visualización</label>
        <Input id="category-order" className={inputClass} type="number" value={values.order} onChange={(event) => setValues({ ...values, order: Number(event.target.value) })} />
        <p className="mt-1.5 text-[11px] text-neutral-400">Define la posición de esta sección en el menú.</p>
      </div>
      <div className="rounded-[13px] border border-neutral-200/80 bg-[#fafafa] p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-neutral-800">Categoría activa</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">Disponible para mostrar en el menú público.</span>
          </span>
          <input type="checkbox" aria-label="Categoría activa" className="h-4 w-4 shrink-0 cursor-pointer accent-central-orange" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} />
        </label>
      </div>
      <div className="flex min-w-0 justify-end gap-2 border-t border-neutral-100 pt-4">
        <Button type="button" variant="secondary" className="!rounded-[11px] !border-neutral-200 !bg-[#f7f7f9] !px-4 !text-[12px] !font-medium !text-neutral-600 !shadow-none hover:!bg-neutral-100" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="!rounded-[11px] !bg-[#191b20] !px-4 !text-[12px] !font-medium !shadow-none hover:!bg-neutral-700" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar categoría'}</Button>
      </div>
    </form>
  );
}
