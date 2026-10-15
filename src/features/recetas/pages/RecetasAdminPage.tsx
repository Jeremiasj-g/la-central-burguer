'use client';

import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Package, Scale } from 'lucide-react';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { useProductoReceta } from '../hooks/useProductoReceta';
import { useIngredientes } from '@/features/ingredientes/hooks/useIngredientes';
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

  const definedCount = ingredientRows.filter((item) => item.quantity !== null && item.quantity !== undefined).length;

  return (
    <div className="catalog-wallet min-w-0 pb-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Composición de productos</h1>
        <p className="mt-1 text-[13px] leading-5 text-neutral-500">
          Consultá los ingredientes asociados a cada producto de tu catálogo.
        </p>
      </div>

      <div className="mb-5 grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,1fr)]">
        <section aria-label="Resumen de composición" className="relative flex min-w-0 flex-col overflow-hidden rounded-[23px] bg-[#191b20] p-5 text-white shadow-soft sm:p-6">
          <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-central-orange/10 blur-[60px]" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[.12em] text-white/45">Ficha de composición</p>
              <p className="mt-1 text-[12px] leading-5 text-white/55">Ingredientes del producto seleccionado</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[.08] text-white/80">
              <BookOpen size={20} strokeWidth={1.7} />
            </span>
          </div>
          <div className="relative mt-7 min-w-0">
            <p className="max-w-full break-words text-[20px] font-semibold leading-7 tracking-[-.035em] sm:text-[25px]">
              {selectedProduct?.name ?? 'Seleccioná un producto'}
            </p>
            <p className="mt-3 text-[13px] text-white/60">
              {isLoading ? 'Consultando ingredientes…' : `${ingredientRows.length.toLocaleString('es-AR')} ${ingredientRows.length === 1 ? 'ingrediente asociado' : 'ingredientes asociados'}`}
            </p>
          </div>
          <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] text-white/55"><CheckCircle2 size={14} className="text-emerald-300" strokeWidth={1.7} /> Con cantidad</p>
              <p className="mt-1.5 text-[24px] font-semibold tracking-[-.045em] tabular-nums text-[#c7f0d7]">{isLoading ? '—' : definedCount}</p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="flex items-center gap-1.5 text-[11px] text-white/55"><Scale size={14} className="text-white/65" strokeWidth={1.7} /> A definir</p>
              <p className="mt-1.5 text-[24px] font-semibold tracking-[-.045em] tabular-nums text-white/85">{isLoading ? '—' : ingredientRows.length - definedCount}</p>
            </div>
          </div>
        </section>

        <section aria-label="Seleccionar producto de la receta" className="flex min-w-0 flex-col justify-center rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Explorar una receta</h2>
              <p className="mt-0.5 text-[11px] leading-5 text-neutral-500">Elegí un producto para consultar su composición.</p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f7f7f9] text-neutral-500"><Package size={17} strokeWidth={1.8} /></span>
          </div>
          <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Producto</span>
          <SearchableSelect
            aria-label="Seleccionar producto para ver su receta"
            value={selectedProductId}
            options={productos.map((product) => ({ value: product.id, label: product.name }))}
            onValueChange={setProductId}
            placeholder="Seleccionar producto"
            searchPlaceholder="Buscar producto…"
            emptyMessage="No se encontraron productos."
            className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !text-[12px] !font-normal !shadow-none"
          />
          <p className="mt-3 text-[11px] leading-5 text-neutral-400">Visor de ingredientes asociados, sin cálculo automático de precios.</p>
        </section>
      </div>

      <div className="mb-3 min-w-0 px-0.5">
        <h2 className="text-[20px] font-semibold tracking-[-.035em] text-neutral-950">Detalle de ingredientes</h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">Cantidades y unidades de la composición registrada.</p>
      </div>

      {productsError || ingredientsError || recipeError ? (
        <DataLoadError
          message={productsError ?? ingredientsError ?? recipeError ?? 'No se pudo cargar la composición.'}
          onRetry={async () => {
            await Promise.all([refreshProducts(), refreshIngredients(), refreshRecipe()]);
          }}
        />
      ) : isLoading ? (
        <div role="status" aria-label="Cargando composición" className="overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white p-5 shadow-soft">
          <div className="animate-pulse space-y-4 motion-reduce:animate-none">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                <div className="h-4 w-40 max-w-[55%] rounded-lg bg-neutral-100" />
                <div className="h-4 w-20 rounded-lg bg-neutral-100" />
              </div>
            ))}
          </div>
        </div>
      ) : ingredientRows.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[20px] border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-soft">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#f7f7f9] text-neutral-400"><BookOpen size={22} strokeWidth={1.7} /></span>
          <p className="mt-3 text-[14px] font-semibold text-neutral-900">Sin ingredientes asociados</p>
          <p className="mt-1 text-[12px] text-neutral-500">Este producto todavía no tiene ingredientes registrados.</p>
        </div>
      ) : (
        <section aria-label="Ingredientes de la receta" className="min-w-0">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:hidden">
            {ingredientRows.map((item) => {
              const ing = ingredientById[item.ingredientId];
              return (
                <article key={item.id} className="rounded-[17px] border border-neutral-200/75 bg-white p-4 shadow-[0_8px_28px_-24px_rgba(20,20,20,.3)]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#f7f7f9] text-neutral-500"><Package size={17} strokeWidth={1.8} /></span>
                    <p className="min-w-0 break-words text-[13px] font-semibold text-neutral-900">{ing?.name ?? item.ingredientId}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-[12px] bg-[#f8f8f9] px-3 py-2.5">
                    <div>
                      <p className="text-[10px] text-neutral-400">Cantidad</p>
                      <p className="mt-1 text-[12px] font-medium tabular-nums text-neutral-800">{item.quantity ?? 'A definir'}</p>
                    </div>
                    <div className="border-l border-neutral-200/70 pl-3">
                      <p className="text-[10px] text-neutral-400">Unidad</p>
                      <p className="mt-1 text-[12px] font-medium text-neutral-800">{item.unit ?? ing?.unit ?? '-'}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white shadow-soft lg:block">
            <table className="w-full table-fixed text-left text-[12px] text-neutral-700">
              <colgroup><col className="w-[55%]" /><col className="w-[22%]" /><col className="w-[23%]" /></colgroup>
              <thead className="border-b border-neutral-100 bg-[#f8f8f9] text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Ingrediente</th>
                  <th className="px-5 py-3.5 font-medium">Cantidad</th>
                  <th className="px-5 py-3.5 font-medium">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ingredientRows.map((item) => {
                  const ing = ingredientById[item.ingredientId];
                  return (
                    <tr key={item.id} className="transition-colors duration-200 hover:bg-[#fafafa]">
                      <td className="px-5 py-4"><p className="truncate text-[12px] font-semibold text-neutral-900" title={ing?.name ?? item.ingredientId}>{ing?.name ?? item.ingredientId}</p></td>
                      <td className="px-5 py-4 text-[12px] tabular-nums text-neutral-600">{item.quantity ?? 'A definir'}</td>
                      <td className="px-5 py-4 text-[12px] text-neutral-600">{item.unit ?? ing?.unit ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
