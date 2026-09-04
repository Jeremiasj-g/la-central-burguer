import { Edit, Eye, EyeOff, Power, Star, Trash2 } from 'lucide-react';
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
      <div className="overflow-x-auto custom-scrollbar md:overflow-x-hidden">
        <table className="w-full min-w-[1040px] table-fixed text-sm text-neutral-700 md:min-w-0">
          <colgroup>
            <col className="w-[35%] xl:w-[31%]" />
            <col className="hidden xl:table-column xl:w-[12%]" />
            <col className="hidden xl:table-column xl:w-[15%]" />
            <col className="w-[15%] xl:w-[9%]" />
            <col className="w-[20%] xl:w-[13%]" />
            <col className="w-[30%] xl:w-[20%]" />
          </colgroup>
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-600">
            <tr>
              <th className="px-3 py-4 xl:px-4 2xl:px-6">Producto</th>
              <th className="hidden px-3 py-4 xl:table-cell xl:px-4 2xl:px-6">Categoría</th>
              <th className="hidden px-3 py-4 xl:table-cell xl:px-4 2xl:px-6">Ingredientes</th>
              <th className="px-3 py-4 xl:px-4 2xl:px-6">Precio</th>
              <th className="px-3 py-4 xl:px-4 2xl:px-6">Estado</th>
              <th className="px-3 py-4 text-right xl:px-4 2xl:px-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map((product) => {
              const ingredientNames = [
                ...(product.ingredientIds ?? []).map((id) => ingredientById[id]).filter(Boolean),
              ];
              return (
                <tr key={product.id}>
                  <td className="px-3 py-4 xl:px-4 2xl:px-6">
                    <div className="flex min-w-0 items-center gap-2 xl:gap-3">
                      <ProductImageMedia
                        imageUrl={product.imageUrl}
                        productName={product.name}
                        categoryName={categoryById[product.categoryId]}
                        className="h-12 w-12 shrink-0 rounded-sm xl:h-14 xl:w-14"
                        compact
                      />
                      <div className="min-w-0">
                        <p className="truncate font-black text-central-carbon" title={product.name}>{product.name}</p>
                        <p className="truncate text-xs text-neutral-500 xl:hidden" title={`${categoryById[product.categoryId] ?? 'Sin categoría'} · ${ingredientNames.length > 0 ? ingredientNames.join(', ') : 'Sin ingredientes'}`}>
                          {categoryById[product.categoryId] ?? 'Sin categoría'} · {ingredientNames.length > 0 ? ingredientNames.join(', ') : 'Sin ingredientes'}
                        </p>
                        <p className="hidden truncate text-xs text-neutral-500 xl:block" title={product.description || 'Sin descripción adicional'}>{product.description || 'Sin descripción adicional'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-4 text-neutral-700 xl:table-cell xl:px-4 2xl:px-6">
                    <p className="truncate" title={categoryById[product.categoryId] ?? 'Sin categoría'}>{categoryById[product.categoryId] ?? 'Sin categoría'}</p>
                  </td>
                  <td className="hidden px-3 py-4 text-neutral-600 xl:table-cell xl:px-4 2xl:px-6">
                    <p
                      className="line-clamp-2 break-words"
                      title={`${ingredientNames.length > 0 ? ingredientNames.slice(0, 3).join(', ') : 'Sin ingredientes'}${ingredientNames.length > 3 ? ` +${ingredientNames.length - 3}` : ''}`}
                    >
                      {ingredientNames.length > 0 ? ingredientNames.slice(0, 3).join(', ') : 'Sin ingredientes'}
                      {ingredientNames.length > 3 ? ` +${ingredientNames.length - 3}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-4 font-black text-central-orange xl:px-4 2xl:px-6">
                    <span className="whitespace-nowrap">{formatCurrency(product.currentPrice)}</span>
                  </td>
                  <td className="px-3 py-4 xl:px-4 2xl:px-6">
                    <div className="flex flex-col items-start gap-1 2xl:flex-row 2xl:flex-wrap 2xl:gap-2">
                      <Badge className="max-w-full whitespace-nowrap px-2" tone={product.active ? 'green' : 'red'}>{product.active ? 'Activo' : 'Inactivo'}</Badge>
                      <Badge className="max-w-full whitespace-nowrap px-2" tone={product.available ? 'green' : 'red'}>{product.available ? 'Disponible' : 'No disponible'}</Badge>
                      {product.featured ? <Badge className="max-w-full whitespace-nowrap px-2" tone="orange">Destacado</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-4 xl:px-4 2xl:px-6">
                    <div className="flex flex-wrap justify-end gap-1 xl:gap-2">
                      <Button aria-label={product.available ? 'Marcar como no disponible' : 'Marcar como disponible'} title={product.available ? 'Marcar como no disponible' : 'Marcar como disponible'} className={iconButtonClass} size="sm" variant="secondary" onClick={() => onToggleAvailable(product.id)}>{product.available ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
                      <Button aria-label={product.featured ? 'Quitar producto destacado' : 'Destacar producto'} title={product.featured ? 'Quitar producto destacado' : 'Destacar producto'} className={iconButtonClass} size="sm" variant="secondary" onClick={() => onToggleFeatured(product.id)}><Star className={product.featured ? 'fill-current text-central-orange' : undefined} size={16} /></Button>
                      <Button aria-label={product.active ? 'Desactivar producto' : 'Activar producto'} title={product.active ? 'Desactivar producto' : 'Activar producto'} className={iconButtonClass} size="sm" variant="secondary" onClick={() => onToggleActive(product.id)}><Power size={16} /></Button>
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
