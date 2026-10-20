'use client';

import { Edit3, History, Package, Power, Trash2 } from 'lucide-react';
import type { Ingredient } from '../types/ingrediente.types';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

type IngredienteTableProps = {
  ingredients: Ingredient[];
  onEdit: (ingredient: Ingredient) => void;
  onHistory: (ingredient: Ingredient) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
};

const iconButtonClass = 'grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-neutral-200/80 bg-white text-neutral-600 outline-none transition-[background-color,border-color,color,transform] duration-200 hover:border-central-orange/35 hover:bg-central-orange/[.06] hover:text-central-orange focus-visible:ring-2 focus-visible:ring-central-orange/25 active:scale-[.97]';

function IngredientStatus({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/75' : 'bg-neutral-100 text-neutral-500 ring-neutral-200'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function IngredientActions({ ingredient, onEdit, onDelete, onToggleActive }: { ingredient: Ingredient } & Omit<IngredienteTableProps, 'ingredients'>) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" aria-label={ingredient.active ? 'Desactivar ingrediente' : 'Activar ingrediente'} title={ingredient.active ? 'Desactivar ingrediente' : 'Activar ingrediente'} className={iconButtonClass} onClick={() => onToggleActive(ingredient.id)}>
        <Power size={15} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label={'Ver historial de costos de ' + ingredient.name} title="Historial de costos" className={iconButtonClass} onClick={() => onHistory(ingredient)}>
        <History size={15} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label="Editar ingrediente" title="Editar ingrediente" className={iconButtonClass} onClick={() => onEdit(ingredient)}>
        <Edit3 size={15} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label="Eliminar ingrediente" title="Eliminar ingrediente" className={`${iconButtonClass} !border-red-200/80 !bg-red-50 !text-red-600 hover:!border-red-300 hover:!bg-red-100`} onClick={() => onDelete(ingredient.id)}>
        <Trash2 size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function IngredienteTable({ ingredients, onEdit, onHistory, onDelete, onToggleActive }: IngredienteTableProps) {
  if (ingredients.length === 0) {
    return (
      <div className="flex min-h-[230px] flex-col items-center justify-center rounded-[20px] border border-neutral-200/70 bg-white p-6 text-center shadow-soft">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#f7f7f9] text-neutral-400"><Package size={22} strokeWidth={1.7} /></span>
        <h3 className="mt-3 text-[14px] font-semibold text-neutral-900">No encontramos ingredientes</h3>
        <p className="mt-1 text-[12px] text-neutral-500">Agregá ingredientes o probá con otra búsqueda.</p>
      </div>
    );
  }

  return (
    <section aria-label="Ingredientes registrados" className="min-w-0">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:hidden">
        {ingredients.map((ingredient) => (
          <article key={ingredient.id} className="flex min-w-0 flex-col rounded-[17px] border border-neutral-200/75 bg-white p-4 shadow-[0_8px_28px_-24px_rgba(20,20,20,.3)] transition-[border-color,box-shadow] duration-200 hover:border-neutral-300 hover:shadow-[0_12px_32px_-24px_rgba(20,20,20,.4)]">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#f7f7f9] text-neutral-500"><Package size={17} strokeWidth={1.8} /></span>
              <IngredientStatus active={ingredient.active} />
            </div>
            <h3 className="mt-3 truncate text-[14px] font-semibold tracking-[-.015em] text-neutral-900" title={ingredient.name}>{ingredient.name}</h3>
            <p className="mt-1 truncate text-[12px] text-neutral-500" title={ingredient.supplier ?? 'Sin proveedor'}>{ingredient.supplier || 'Sin proveedor'}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-[12px] bg-[#f8f8f9] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] text-neutral-400">Tipo</p>
                <p className="mt-0.5 truncate text-[12px] font-medium capitalize text-neutral-700" title={ingredient.type}>{ingredient.type}</p>
              </div>
              <div className="min-w-0 border-l border-neutral-200/75 pl-3">
                <p className="text-[10px] text-neutral-400">Unidad</p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-700" title={ingredient.unit}>{ingredient.unit}</p>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 items-center justify-between gap-2 rounded-[10px] bg-[#f7f7f9] px-3 py-2">
              <span className="text-[10px] text-neutral-500">Costo base / {ingredient.unit}</span>
              <span className="truncate text-[12px] font-semibold tabular-nums text-neutral-800">{ingredient.unitCost > 0 ? formatCurrency(ingredient.unitCost) : 'Pendiente'}</span>
            </div>
            <div className="mt-auto flex items-end justify-between gap-2 border-t border-neutral-100 pt-3">
              <div className="min-w-0">
                <p className="text-[10px] text-neutral-400">Actualización</p>
                <p className="mt-1 truncate text-[11px] text-neutral-500" title={formatDateTime(ingredient.lastUpdatedAt)}>{formatDateTime(ingredient.lastUpdatedAt)}</p>
              </div>
              <IngredientActions ingredient={ingredient} onEdit={onEdit} onHistory={onHistory} onDelete={onDelete} onToggleActive={onToggleActive} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white shadow-soft xl:block">
        <table className="w-full table-fixed text-left text-[12px] text-neutral-700">
          <colgroup>
            <col className="w-[23%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="border-b border-neutral-100 bg-[#f8f8f9] text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
            <tr>
              <th className="px-4 py-3.5 font-medium">Ingrediente</th>
              <th className="px-4 py-3.5 font-medium">Tipo</th>
              <th className="px-3 py-3.5 font-medium">Unidad</th>
              <th className="px-3 py-3.5 font-medium">Costo base</th>
              <th className="px-3 py-3.5 font-medium">Estado</th>
              <th className="px-4 py-3.5 font-medium">Actualización</th>
              <th className="px-3 py-3.5 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {ingredients.map((ingredient) => (
              <tr key={ingredient.id} className="transition-colors duration-200 hover:bg-[#fafafa]">
                <td className="px-4 py-4">
                  <p className="truncate text-[12px] font-semibold text-neutral-900" title={ingredient.name}>{ingredient.name}</p>
                  <p className="mt-1 truncate text-[11px] text-neutral-500" title={ingredient.supplier ?? 'Sin proveedor'}>{ingredient.supplier || 'Sin proveedor'}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex max-w-full truncate rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium capitalize text-neutral-600">{ingredient.type}</span>
                </td>
                <td className="px-3 py-4 text-[11px] text-neutral-600">{ingredient.unit}</td>
                <td className="px-3 py-4">
                  <p className="truncate text-[12px] font-semibold tabular-nums text-neutral-800" title={ingredient.unitCost > 0 ? formatCurrency(ingredient.unitCost) : 'Pendiente'}>
                    {ingredient.unitCost > 0 ? formatCurrency(ingredient.unitCost) : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">por {ingredient.unit}</p>
                </td>
                <td className="px-3 py-4"><IngredientStatus active={ingredient.active} /></td>
                <td className="px-4 py-4">
                  <p className="truncate text-[11px] text-neutral-500" title={formatDateTime(ingredient.lastUpdatedAt)}>{formatDateTime(ingredient.lastUpdatedAt)}</p>
                </td>
                <td className="px-3 py-4"><IngredientActions ingredient={ingredient} onEdit={onEdit} onHistory={onHistory} onDelete={onDelete} onToggleActive={onToggleActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
