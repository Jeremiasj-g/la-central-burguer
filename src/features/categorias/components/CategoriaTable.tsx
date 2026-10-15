'use client';

import { Edit3, Layers, Power, Trash2 } from 'lucide-react';
import type { Category } from '../types/categoria.types';

type CategoriaTableProps = {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
};

const iconButtonClass = 'grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-neutral-200/80 bg-white text-neutral-600 outline-none transition-[background-color,border-color,color,transform] duration-200 hover:border-central-orange/35 hover:bg-central-orange/[.06] hover:text-central-orange focus-visible:ring-2 focus-visible:ring-central-orange/25 active:scale-[.97]';

function CategoryStatus({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/75' : 'bg-neutral-100 text-neutral-500 ring-neutral-200'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
      {active ? 'Activa' : 'Inactiva'}
    </span>
  );
}

function CategoryActions({ category, onEdit, onDelete, onToggleActive }: { category: Category } & Omit<CategoriaTableProps, 'categories'>) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" aria-label={category.active ? 'Desactivar categoría' : 'Activar categoría'} title={category.active ? 'Desactivar categoría' : 'Activar categoría'} className={iconButtonClass} onClick={() => onToggleActive(category.id)}>
        <Power size={15} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label="Editar categoría" title="Editar categoría" className={iconButtonClass} onClick={() => onEdit(category)}>
        <Edit3 size={15} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label="Eliminar categoría" title="Eliminar categoría" className={`${iconButtonClass} !border-red-200/80 !bg-red-50 !text-red-600 hover:!border-red-300 hover:!bg-red-100`} onClick={() => onDelete(category.id)}>
        <Trash2 size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function CategoriaTable({ categories, onEdit, onDelete, onToggleActive }: CategoriaTableProps) {
  if (categories.length === 0) {
    return (
      <div className="flex min-h-[230px] flex-col items-center justify-center rounded-[20px] border border-neutral-200/70 bg-white p-6 text-center shadow-soft">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#f7f7f9] text-neutral-400"><Layers size={22} strokeWidth={1.7} /></span>
        <h3 className="mt-3 text-[14px] font-semibold text-neutral-900">Todavía no hay categorías</h3>
        <p className="mt-1 text-[12px] text-neutral-500">Creá una categoría para organizar tu menú.</p>
      </div>
    );
  }

  return (
    <section aria-label="Categorías registradas" className="min-w-0">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:hidden">
        {categories.map((category) => (
          <article key={category.id} className="flex min-w-0 flex-col rounded-[17px] border border-neutral-200/75 bg-white p-4 shadow-[0_8px_28px_-24px_rgba(20,20,20,.3)] transition-[border-color,box-shadow] duration-200 hover:border-neutral-300 hover:shadow-[0_12px_32px_-24px_rgba(20,20,20,.4)]">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#f7f7f9] text-neutral-500"><Layers size={17} strokeWidth={1.8} /></span>
              <CategoryStatus active={category.active} />
            </div>
            <h3 className="mt-3 truncate text-[14px] font-semibold tracking-[-.015em] text-neutral-900" title={category.name}>{category.name}</h3>
            <p className="mt-1 line-clamp-2 min-h-9 break-words text-[12px] leading-[18px] text-neutral-500" title={category.description}>{category.description || 'Sin descripción'}</p>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
              <p className="text-[11px] text-neutral-500">Orden <span className="ml-1 font-semibold tabular-nums text-neutral-800">{category.order}</span></p>
              <CategoryActions category={category} onEdit={onEdit} onDelete={onDelete} onToggleActive={onToggleActive} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white shadow-soft xl:block">
        <table className="w-full table-fixed text-left text-[12px] text-neutral-700">
          <colgroup><col className="w-[48%]" /><col className="w-[13%]" /><col className="w-[17%]" /><col className="w-[22%]" /></colgroup>
          <thead className="border-b border-neutral-100 bg-[#f8f8f9] text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
            <tr>
              <th className="px-5 py-3.5 font-medium">Categoría</th>
              <th className="px-5 py-3.5 font-medium">Orden</th>
              <th className="px-5 py-3.5 font-medium">Estado</th>
              <th className="px-5 py-3.5 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {categories.map((category) => (
              <tr key={category.id} className="transition-colors duration-200 hover:bg-[#fafafa]">
                <td className="px-5 py-4">
                  <p className="truncate text-[12px] font-semibold text-neutral-900" title={category.name}>{category.name}</p>
                  <p className="mt-1 truncate text-[11px] text-neutral-500" title={category.description}>{category.description || 'Sin descripción'}</p>
                </td>
                <td className="px-5 py-4 tabular-nums text-neutral-600">{category.order}</td>
                <td className="px-5 py-4"><CategoryStatus active={category.active} /></td>
                <td className="px-5 py-4"><CategoryActions category={category} onEdit={onEdit} onDelete={onDelete} onToggleActive={onToggleActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
