import { Edit, Power, Trash2 } from 'lucide-react';
import type { Ingredient } from '../types/ingrediente.types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { formatDateTime } from '@/shared/utils/format.utils';

const iconButtonClass = 'h-9 w-9 rounded-sm px-0 border-neutral-200 bg-white text-central-carbon hover:border-central-orange/50 hover:text-central-orange';

export function IngredienteTable({ ingredients, onEdit, onDelete, onToggleActive }: { ingredients: Ingredient[]; onEdit: (ingredient: Ingredient) => void; onDelete: (id: string) => void; onToggleActive: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="overflow-x-auto custom-scrollbar md:overflow-x-hidden">
        <table className="w-full min-w-[820px] table-fixed text-sm text-neutral-700 md:min-w-0">
          <colgroup>
            <col className="w-[40%] xl:w-[35%]" />
            <col className="w-[18%] xl:w-[15%]" />
            <col className="hidden xl:table-column xl:w-[12%]" />
            <col className="w-[20%] xl:w-[18%]" />
            <col className="w-[22%] xl:w-[20%]" />
          </colgroup>
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-600">
            <tr>
              <th className="px-2 py-4 xl:px-6">Ingrediente</th>
              <th className="px-2 py-4 xl:px-6">Tipo</th>
              <th className="hidden px-2 py-4 xl:table-cell xl:px-6">Unidad</th>
              <th className="px-2 py-4 xl:px-6">Actualización</th>
              <th className="px-2 py-4 text-right xl:px-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {ingredients.map((ingredient) => (
              <tr key={ingredient.id}>
                <td className="px-2 py-4 xl:px-6">
                  <p className="truncate font-black text-central-carbon" title={ingredient.name}>{ingredient.name}</p>
                  <p className="truncate text-xs text-neutral-500" title={`${ingredient.supplier ?? 'Sin proveedor'} · ${ingredient.unit}`}>{ingredient.supplier ?? 'Sin proveedor'}<span className="xl:hidden"> · {ingredient.unit}</span></p>
                </td>
                <td className="px-2 py-4 xl:px-6"><Badge className="max-w-full truncate" tone="neutral">{ingredient.type}</Badge></td>
                <td className="hidden px-2 py-4 text-neutral-600 xl:table-cell xl:px-6"><p className="truncate" title={ingredient.unit}>{ingredient.unit}</p></td>
                <td className="px-2 py-4 text-neutral-500 xl:px-6"><p className="truncate" title={formatDateTime(ingredient.lastUpdatedAt)}>{formatDateTime(ingredient.lastUpdatedAt)}</p></td>
                <td className="px-2 py-4 xl:px-6">
                  <div className="flex flex-wrap justify-end gap-1 xl:gap-2">
                    <Button aria-label={ingredient.active ? 'Desactivar ingrediente' : 'Activar ingrediente'} title={ingredient.active ? 'Desactivar ingrediente' : 'Activar ingrediente'} className={iconButtonClass} size="sm" variant="secondary" onClick={() => onToggleActive(ingredient.id)}><Power size={16} /></Button>
                    <Button aria-label="Editar ingrediente" title="Editar ingrediente" className={iconButtonClass} size="sm" variant="secondary" onClick={() => onEdit(ingredient)}><Edit size={16} /></Button>
                    <Button aria-label="Eliminar ingrediente" title="Eliminar ingrediente" className="h-9 w-9 rounded-sm px-0" size="sm" variant="danger" onClick={() => onDelete(ingredient.id)}><Trash2 size={16} /></Button>
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
