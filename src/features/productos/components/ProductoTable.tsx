import { Edit, Eye, EyeOff, Star, Trash2 } from 'lucide-react';
import type { Product } from '../types/producto.types';
import type { Category } from '@/features/categorias/types/categoria.types';
import type { Ingredient } from '@/features/ingredientes/types/ingrediente.types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { formatCurrency } from '@/shared/utils/format.utils';
import { ProductImageMedia } from './ProductImageMedia';

interface ProductoTableProps {
  products: Product[];
  categories: Category[];
  ingredients: Ingredient[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
  onToggleAvailable: (id: string) => void;
  onToggleFeatured: (id: string) => void;
}

const iconButtonClass = 'h-9 w-9 rounded-sm px-0 border-neutral-200 bg-white text-central-carbon hover:border-central-orange/50 hover:text-central-orange';

export function ProductoTable({ products, categories, ingredients, onEdit, onDelete, onToggleActive, onToggleAvailable, onToggleFeatured }: ProductoTableProps) {
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  const ingredientById = Object.fromEntries(ingredients.map((ingredient) => [ingredient.id, ingredient.name]));

  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[1040px] text-sm text-neutral-700">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-600">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Categoría</th>
              <th className="px-6 py-4">Ingredientes</th>
              <th className="px-6 py-4">Precio</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map((product) => {
              const ingredientNames = [
                ...(product.ingredientIds ?? []).map((id) => ingredientById[id]).filter(Boolean),
              ];
              return (
                <tr key={product.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <ProductImageMedia
                        imageUrl={product.imageUrl}
                        productName={product.name}
                        categoryName={categoryById[product.categoryId]}
                        className="h-14 w-14 rounded-sm"
                        compact
                      />
                      <div>
                        <p className="font-black text-central-carbon">{product.name}</p>
                        <p className="max-w-md truncate text-xs text-neutral-500">{product.description || 'Sin descripción adicional'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-neutral-700">{categoryById[product.categoryId] ?? 'Sin categoría'}</td>
                  <td className="px-6 py-4 text-neutral-600">
                    {ingredientNames.length > 0 ? ingredientNames.slice(0, 3).join(', ') : 'Sin ingredientes'}
                    {ingredientNames.length > 3 ? ` +${ingredientNames.length - 3}` : ''}
                  </td>
                  <td className="px-6 py-4 font-black text-central-orange">{formatCurrency(product.currentPrice)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={product.active ? 'green' : 'red'}>{product.active ? 'Activo' : 'Inactivo'}</Badge>
                      <Badge tone={product.available ? 'green' : 'red'}>{product.available ? 'Disponible' : 'No disponible'}</Badge>
                      {product.featured ? <Badge tone="orange">Destacado</Badge> : null}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button aria-label={product.available ? 'Marcar como no disponible' : 'Marcar como disponible'} title={product.available ? 'Marcar como no disponible' : 'Marcar como disponible'} className={iconButtonClass} size="sm" variant="secondary" onClick={() => onToggleAvailable(product.id)}>{product.available ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
                      <Button aria-label="Destacar producto" title="Destacar producto" className={iconButtonClass} size="sm" variant="secondary" onClick={() => onToggleFeatured(product.id)}><Star size={16} /></Button>
                      <Button title={product.active ? 'Desactivar producto' : 'Activar producto'} size="sm" variant="secondary" onClick={() => onToggleActive(product.id)}>{product.active ? 'Desactivar' : 'Activar'}</Button>
                      <Button aria-label="Editar producto" title="Editar producto" className={iconButtonClass} size="sm" variant="secondary" onClick={() => onEdit(product)}><Edit size={16} /></Button>
                      <Button aria-label="Eliminar producto" title="Eliminar producto" className="h-9 w-9 rounded-sm px-0" size="sm" variant="danger" onClick={() => onDelete(product.id)}><Trash2 size={16} /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
