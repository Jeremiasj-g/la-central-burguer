import { Edit, Power, Trash2 } from 'lucide-react';
import type { Category } from '../types/categoria.types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';

const iconButtonClass = 'h-9 w-9 rounded-sm px-0 border-neutral-200 bg-white text-central-carbon hover:border-central-orange/50 hover:text-central-orange';

export function CategoriaTable({ categories, onEdit, onDelete, onToggleActive }: { categories: Category[]; onEdit: (category: Category) => void; onDelete: (id: string) => void; onToggleActive: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="overflow-x-auto custom-scrollbar md:overflow-x-hidden">
        <table className="w-full min-w-[760px] table-fixed text-sm text-neutral-700 md:min-w-0">
          <colgroup>
            <col className="w-[53%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[22%]" />
          </colgroup>
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-600">
            <tr>
              <th className="px-2 py-4 xl:px-6">Categoría</th>
              <th className="px-2 py-4 xl:px-6">Orden</th>
              <th className="px-2 py-4 xl:px-6">Estado</th>
              <th className="px-2 py-4 text-right xl:px-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-2 py-4 xl:px-6">
                  <p className="truncate font-black text-central-carbon" title={category.name}>{category.name}</p>
                  <p className="truncate text-xs text-neutral-500" title={category.description}>{category.description}</p>
                </td>
                <td className="px-2 py-4 font-bold xl:px-6">{category.order}</td>
                <td className="px-2 py-4 xl:px-6"><Badge tone={category.active ? 'green' : 'red'}>{category.active ? 'Activa' : 'Inactiva'}</Badge></td>
                <td className="px-2 py-4 xl:px-6">
                  <div className="flex flex-wrap justify-end gap-1 xl:gap-2">
                    <Button aria-label={category.active ? 'Desactivar categoría' : 'Activar categoría'} title={category.active ? 'Desactivar categoría' : 'Activar categoría'} className={iconButtonClass} size="sm" variant="secondary" onClick={() => onToggleActive(category.id)}><Power size={16} /></Button>
                    <Button aria-label="Editar categoría" title="Editar categoría" className={iconButtonClass} size="sm" variant="secondary" onClick={() => onEdit(category)}><Edit size={16} /></Button>
                    <Button aria-label="Eliminar categoría" title="Eliminar categoría" className="h-9 w-9 rounded-sm px-0" size="sm" variant="danger" onClick={() => onDelete(category.id)}><Trash2 size={16} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
