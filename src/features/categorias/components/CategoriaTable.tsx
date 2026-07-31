import { Edit, Trash2 } from 'lucide-react';
import type { Category } from '../types/categoria.types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';

const iconButtonClass = 'h-9 w-9 rounded-sm px-0 border-neutral-200 bg-white text-central-carbon hover:border-central-orange/50 hover:text-central-orange';

export function CategoriaTable({ categories, onEdit, onDelete, onToggleActive }: { categories: Category[]; onEdit: (category: Category) => void; onDelete: (id: string) => void; onToggleActive: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[760px] text-sm text-neutral-700">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-600">
            <tr><th className="px-6 py-4">Categoría</th><th className="px-6 py-4">Orden</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-6 py-4"><p className="font-black text-central-carbon">{category.name}</p><p className="text-xs text-neutral-500">{category.description}</p></td>
                <td className="px-6 py-4 font-bold">{category.order}</td>
                <td className="px-6 py-4"><Badge tone={category.active ? 'green' : 'red'}>{category.active ? 'Activa' : 'Inactiva'}</Badge></td>
                <td className="px-6 py-4"><div className="flex justify-end gap-2"><Button title={category.active ? 'Desactivar categoría' : 'Activar categoría'} size="sm" variant="secondary" onClick={() => onToggleActive(category.id)}>{category.active ? 'Desactivar' : 'Activar'}</Button><Button aria-label="Editar categoría" title="Editar categoría" className={iconButtonClass} size="sm" variant="secondary" onClick={() => onEdit(category)}><Edit size={16} /></Button><Button aria-label="Eliminar categoría" title="Eliminar categoría" className="h-9 w-9 rounded-sm px-0" size="sm" variant="danger" onClick={() => onDelete(category.id)}><Trash2 size={16} /></Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
