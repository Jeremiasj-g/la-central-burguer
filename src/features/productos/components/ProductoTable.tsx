'use client';

import { Edit3, Eye, EyeOff, Package, Power, Star, Trash2 } from 'lucide-react';
import type { Product } from '../types/producto.types';
import type { Category } from '@/features/categorias/types/categoria.types';
import type { Ingredient } from '@/features/ingredientes/types/ingrediente.types';
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

const iconButtonClass = 'grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[9px] border border-neutral-200/80 bg-white text-neutral-600 outline-none transition-[background-color,border-color,color,transform] duration-200 hover:border-central-orange/35 hover:bg-central-orange/[.06] hover:text-central-orange focus-visible:ring-2 focus-visible:ring-central-orange/25 active:scale-[.96] sm:h-9 sm:w-9';

function StatusPill({ active, label, inactiveLabel }: { active: boolean; label: string; inactiveLabel: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/75' : 'bg-neutral-100 text-neutral-500 ring-neutral-200'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
      {active ? label : inactiveLabel}
    </span>
  );
}

function ProductActions({ product, onEdit, onDelete, onToggleActive, onToggleAvailable, onToggleFeatured }: { product: Product } & Omit<ProductoTableProps, 'products' | 'categories' | 'ingredients'>) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
      <button type="button" aria-label={product.available ? 'Marcar como no disponible' : 'Marcar como disponible'} title={product.available ? 'Marcar como no disponible' : 'Marcar como disponible'} className={iconButtonClass} onClick={() => onToggleAvailable(product.id)}>
        {product.available ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
      </button>
      <button type="button" aria-label={product.featured ? 'Quitar producto destacado' : 'Destacar producto'} title={product.featured ? 'Quitar producto destacado' : 'Destacar producto'} className={iconButtonClass} onClick={() => onToggleFeatured(product.id)}>
        <Star size={15} strokeWidth={1.8} className={product.featured ? 'fill-current text-central-orange' : ''} />
      </button>
      <button type="button" aria-label={product.active ? 'Desactivar producto' : 'Activar producto'} title={product.active ? 'Desactivar producto' : 'Activar producto'} className={iconButtonClass} onClick={() => onToggleActive(product.id)}>
        <Power size={15} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label="Editar producto" title="Editar producto" className={iconButtonClass} onClick={() => onEdit(product)}>
        <Edit3 size={15} strokeWidth={1.8} />
      </button>
      <button type="button" aria-label="Eliminar producto" title="Eliminar producto" className={`${iconButtonClass} !border-red-200/80 !bg-red-50 !text-red-600 hover:!border-red-300 hover:!bg-red-100`} onClick={() => onDelete(product.id)}>
        <Trash2 size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function ProductoTable({ products, categories, ingredients, onEdit, onDelete, onToggleActive, onToggleAvailable, onToggleFeatured }: ProductoTableProps) {
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  const ingredientById = Object.fromEntries(ingredients.map((ingredient) => [ingredient.id, ingredient.name]));
  const actions = { onEdit, onDelete, onToggleActive, onToggleAvailable, onToggleFeatured };

  if (products.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-soft">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#f7f7f9] text-neutral-400"><Package size={22} strokeWidth={1.7} /></span>
        <h3 className="mt-3 text-[14px] font-semibold text-neutral-900">No encontramos productos</h3>
        <p className="mt-1 max-w-xs text-[12px] leading-5 text-neutral-500">Agregá uno nuevo o probá con otra búsqueda o categoría.</p>
      </div>
    );
  }

  return (
    <section aria-label="Productos registrados" className="min-w-0">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:hidden">
        {products.map((product) => {
          const categoryName = categoryById[product.categoryId] ?? 'Sin categoría';
          const ingredientNames = (product.ingredientIds ?? []).map((id) => ingredientById[id]).filter(Boolean);
          return (
            <article key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-neutral-200/75 bg-white shadow-[0_8px_28px_-24px_rgba(20,20,20,.3)] transition-[border-color,box-shadow] duration-200 hover:border-neutral-300 hover:shadow-[0_12px_32px_-24px_rgba(20,20,20,.4)]">
              <div className="flex min-w-0 items-start gap-3 p-4 pb-3">
                <ProductImageMedia
                  imageUrl={product.imageUrl}
                  productName={product.name}
                  categoryName={categoryName}
                  className="h-[76px] w-[76px] shrink-0 rounded-[13px] sm:h-[82px] sm:w-[82px]"
                  compact
                />
                <div className="min-w-0 flex-1">
                  <p className="mb-1 truncate text-[10px] font-medium text-central-ember" title={categoryName}>{categoryName}</p>
                  <h3 className="line-clamp-2 break-words text-[14px] font-semibold leading-5 tracking-[-.02em] text-neutral-900" title={product.name}>{product.name}</h3>
                  <p className="mt-2 text-[17px] font-semibold tracking-[-.035em] tabular-nums text-neutral-900">{formatCurrency(product.currentPrice)}</p>
                </div>
              </div>
              <div className="px-4">
                <p className="line-clamp-2 min-h-9 break-words text-[11px] leading-[18px] text-neutral-500" title={product.description || 'Sin descripción adicional'}>{product.description || 'Sin descripción adicional'}</p>
                <p className="mt-2 line-clamp-1 text-[11px] text-neutral-400" title={ingredientNames.join(', ') || 'Sin ingredientes'}>
                  {ingredientNames.length > 0 ? `Ingredientes: ${ingredientNames.join(', ')}` : 'Sin ingredientes asociados'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <StatusPill active={product.active} label="Activo" inactiveLabel="Inactivo" />
                  <StatusPill active={product.available} label="Disponible" inactiveLabel="No disponible" />
                  {product.featured ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-central-orange/10 px-2.5 py-1 text-[10px] font-medium text-central-ember ring-1 ring-inset ring-central-orange/15">
                      <Star size={11} strokeWidth={1.8} className="fill-current" /> Destacado
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 bg-[#fafafa] px-3 py-3 sm:px-4">
                <span className="shrink-0 text-[10px] font-medium text-neutral-400">Acciones</span>
                <ProductActions product={product} {...actions} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white shadow-soft 2xl:block">
        <table className="w-full table-fixed text-left text-[12px] text-neutral-700">
          <colgroup>
            <col className="w-[27%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead className="border-b border-neutral-100 bg-[#f8f8f9] text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
            <tr>
              <th className="px-4 py-3.5 font-medium">Producto</th>
              <th className="px-3 py-3.5 font-medium">Categoría</th>
              <th className="px-3 py-3.5 font-medium">Ingredientes</th>
              <th className="px-3 py-3.5 font-medium">Precio</th>
              <th className="px-3 py-3.5 font-medium">Estado</th>
              <th className="px-3 py-3.5 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map((product) => {
              const categoryName = categoryById[product.categoryId] ?? 'Sin categoría';
              const ingredientNames = (product.ingredientIds ?? []).map((id) => ingredientById[id]).filter(Boolean);
              return (
                <tr key={product.id} className="transition-colors duration-200 hover:bg-[#fafafa]">
                  <td className="px-4 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductImageMedia imageUrl={product.imageUrl} productName={product.name} categoryName={categoryName} className="h-12 w-12 shrink-0 rounded-[11px]" compact />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-neutral-900" title={product.name}>{product.name}</p>
                        <p className="mt-1 truncate text-[11px] text-neutral-500" title={product.description || 'Sin descripción adicional'}>{product.description || 'Sin descripción adicional'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5"><p className="truncate text-[11px] text-neutral-600" title={categoryName}>{categoryName}</p></td>
                  <td className="px-3 py-3.5"><p className="line-clamp-2 break-words text-[11px] leading-[18px] text-neutral-500" title={ingredientNames.join(', ') || 'Sin ingredientes'}>{ingredientNames.length > 0 ? ingredientNames.slice(0, 3).join(', ') : 'Sin ingredientes'}{ingredientNames.length > 3 ? ` +${ingredientNames.length - 3}` : ''}</p></td>
                  <td className="px-3 py-3.5"><p className="truncate text-[12px] font-semibold tabular-nums text-neutral-900" title={formatCurrency(product.currentPrice)}>{formatCurrency(product.currentPrice)}</p></td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      <StatusPill active={product.active} label="Activo" inactiveLabel="Inactivo" />
                      <StatusPill active={product.available} label="Disponible" inactiveLabel="No disponible" />
                      {product.featured ? <span className="rounded-full bg-central-orange/10 px-2.5 py-1 text-[10px] font-medium text-central-ember">Destacado</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3.5"><ProductActions product={product} {...actions} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
