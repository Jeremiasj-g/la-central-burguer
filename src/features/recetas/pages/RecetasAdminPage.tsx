'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { useProductoReceta } from '../hooks/useProductoReceta';
import { useIngredientes } from '@/features/ingredientes/hooks/useIngredientes';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/shared/utils/cn';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

const adminInputClass = '!bg-white !text-central-carbon !placeholder:text-neutral-500 border-neutral-200';

export function RecetasAdminPage() {
  const { productos, error: productsError, refresh: refreshProducts } = useProductos({ active: 'all' });
  const { ingredientes, error: ingredientsError, refresh: refreshIngredients } = useIngredientes({ active: 'all' });
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [openOptions, setOpenOptions] = useState(false);
  const selectedProductId = productId || productos[0]?.id || '';
  const selectedProduct = productos.find((product) => product.id === selectedProductId);
  const { recipe, isLoading, error: recipeError, refresh: refreshRecipe } = useProductoReceta(selectedProductId);
  const ingredientById = useMemo(() => Object.fromEntries(ingredientes.map((item) => [item.id, item])), [ingredientes]);
  const ingredientRows = recipe?.ingredients?.length
    ? recipe.ingredients.map((item) => ({ id: item.id, ingredientId: item.ingredientId, quantity: item.quantity, unit: item.unit }))
    : (selectedProduct?.ingredientIds ?? []).map((ingredientId) => ({ id: `${selectedProductId}-${ingredientId}`, ingredientId, quantity: null, unit: null }));

  const filteredProducts = productos.filter((product) => product.name.toLowerCase().includes(search.toLowerCase().trim()));

  function selectProduct(nextProductId: string) {
    const product = productos.find((item) => item.id === nextProductId);
    setProductId(nextProductId);
    setSearch(product?.name ?? '');
    setOpenOptions(false);
  }

  return (
    <div>
      <AdminPageHeader eyebrow="Recetas" title="Composición de productos" description="Visor inicial de ingredientes asociados a cada producto. Sin cálculo automático de precios." />
      <div className="mb-6 max-w-xl rounded-sm border border-neutral-200 bg-white p-4 shadow-soft">
        <label className="mb-2 block text-sm font-bold text-central-carbon">Producto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" size={17} />
          <Input
            className={`pl-10 ${adminInputClass}`}
            value={openOptions ? search : search || selectedProduct?.name || ''}
            onChange={(event) => { setSearch(event.target.value); setOpenOptions(true); }}
            onFocus={() => { setSearch(''); setOpenOptions(true); }}
            placeholder="Buscar producto o desplegar opciones"
          />
          {openOptions ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-sm border border-neutral-200 bg-white p-1 shadow-soft custom-scrollbar">
              {filteredProducts.length ? filteredProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={cn('block w-full rounded-sm px-3 py-2 text-left text-sm font-bold text-central-carbon hover:bg-central-orange/10 hover:text-central-orange', product.id === selectedProductId && 'bg-central-orange/10 text-central-orange')}
                  onMouseDown={(event) => { event.preventDefault(); selectProduct(product.id); }}
                >
                  {product.name}
                </button>
              )) : <p className="px-3 py-3 text-sm text-neutral-500">No se encontraron productos.</p>}
            </div>
          ) : null}
        </div>
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
