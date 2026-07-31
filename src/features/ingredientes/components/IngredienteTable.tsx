import { Edit, Trash2 } from 'lucide-react';
import type { Ingredient } from '../types/ingrediente.types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { formatDateTime } from '@/shared/utils/format.utils';

const iconButtonClass = 'h-9 w-9 rounded-sm px-0 border-neutral-200 bg-white text-central-carbon hover:border-central-orange/50 hover:text-central-orange';

export function IngredienteTable({ ingredients, onEdit, onDelete, onToggleActive }: { ingredients: Ingredient[]; onEdit: (ingredient: Ingredient) => void; onDelete: (id: string) => void; onToggleActive: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[820px] text-sm text-neutral-700">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-600">
            <tr><th className="px-6 py-4">Ingrediente</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Unidad</th><th className="px-6 py-4">Actualización</th><th className="px-6 py-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {ingredients.map((ingredient) => (
              <tr key={ingredient.id}>
                <td className="px-6 py-4"><p className="font-black text-central-carbon">{ingredient.name}</p><p className="text-xs text-neutral-500">{ingredient.supplier ?? 'Sin proveedor'}</p></td>
                <td className="px-6 py-4"><Badge tone="neutral">{ingredient.type}</Badge></td>
                <td className="px-6 py-4 text-neutral-600">{ingredient.unit}</td>
                <td className="px-6 py-4 text-neutral-500">{formatDateTime(ingredient.lastUpdatedAt)}</td>
                <td className="px-6 py-4"><div className="flex justify-end gap-2"><Button title={ingredient.active ? 'Desactivar ingrediente' : 'Activar ingrediente'} size="sm" variant="secondary" onClick={() => onToggleActive(ingredient.id)}>{ingredient.active ? 'Desactivar' : 'Activar'}</Button><Button aria-label="Editar ingrediente" title="Editar ingrediente" className={iconButtonClass} size="sm" variant="secondary" onClick={() => onEdit(ingredient)}><Edit size={16} /></Button><Button aria-label="Eliminar ingrediente" title="Eliminar ingrediente" className="h-9 w-9 rounded-sm px-0" size="sm" variant="danger" onClick={() => onDelete(ingredient.id)}><Trash2 size={16} /></Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
