'use client';

import { useMemo, useState } from 'react';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { useProductoReceta } from '../hooks/useProductoReceta';
import { useIngredientes } from '@/features/ingredientes/hooks/useIngredientes';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { SearchableSelect } from '@/shared/components/ui/SearchableSelect';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

export function RecetasAdminPage() {
  const { productos, error: productsError, refresh: refreshProducts } = useProductos({ active: 'all' });
  const { ingredientes, error: ingredientsError, refresh: refreshIngredients } = useIngredientes({ active: 'all' });
  const [productId, setProductId] = useState('');
  const selectedProductId = productId || productos[0]?.id || '';
  const selectedProduct = productos.find((product) => product.id === selectedProductId);
  const { recipe, isLoading, error: recipeError, refresh: refreshRecipe } = useProductoReceta(selectedProductId);
  const ingredientById = useMemo(() => Object.fromEntries(ingredientes.map((item) => [item.id, item])), [ingredientes]);
  const ingredientRows = recipe?.ingredients?.length
    ? recipe.ingredients.map((item) => ({ id: item.id, ingredientId: item.ingredientId, quantity: item.quantity, unit: item.unit }))
    : (selectedProduct?.ingredientIds ?? []).map((ingredientId) => ({ id: `${selectedProductId}-${ingredientId}`, ingredientId, quantity: null, unit: null }));

  return (
    <div>
      <AdminPageHeader eyebrow="Recetas" title="Composición de productos" description="Visor inicial de ingredientes asociados a cada producto. Sin cálculo automático de precios." />
      <div className="mb-6 max-w-xl rounded-sm border border-neutral-200 bg-white p-4 shadow-soft">
        <label className="mb-2 block text-sm font-bold text-central-carbon">Producto</label>
        <SearchableSelect
          aria-label="Seleccionar producto para ver su receta"
          value={selectedProductId}
          options={productos.map((product) => ({ value: product.id, label: product.name }))}
          onValueChange={setProductId}
          placeholder="Seleccionar producto"
          searchPlaceholder="Buscar producto…"
          emptyMessage="No se encontraron productos."
        />
      </div>
      {productsError || ingredientsError || recipeError ? (
        <DataLoadError
          message={productsError ?? ingredientsError ?? recipeError ?? 'No se pudo cargar la composición.'}
          onRetry={async () => {
            await Promise.all([refreshProducts(), refreshIngredients(), refreshRecipe()]);
          }}
        />
      ) : isLoading ? <div className="rounded-sm bg-white p-6 text-neutral-700 shadow-soft">Cargando composición...</div> : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[760px] text-sm text-neutral-700">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-600">
                <tr><th className="px-6 py-4">Ingrediente</th><th className="px-6 py-4">Cantidad</th><th className="px-6 py-4">Unidad</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ingredientRows.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-10 text-neutral-500">Este producto todavía no tiene ingredientes asociados.</td></tr>
                ) : ingredientRows.map((item) => {
                  const ing = ingredientById[item.ingredientId];
                  return <tr key={item.id}><td className="px-6 py-4 font-black text-central-carbon">{ing?.name ?? item.ingredientId}</td><td className="px-6 py-4">{item.quantity ?? 'A definir'}</td><td className="px-6 py-4">{item.unit ?? ing?.unit ?? '-'}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
