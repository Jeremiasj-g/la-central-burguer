'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeDollarSign,
  Beef,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  Save,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { useIngredientes } from '@/features/ingredientes/hooks/useIngredientes';
import type { Ingredient, IngredientUnit } from '@/features/ingredientes/types/ingrediente.types';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { SearchableSelect } from '@/shared/components/ui/SearchableSelect';
import { Select } from '@/shared/components/ui/Select';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';
import { formatCurrency } from '@/shared/utils/format.utils';
import { useRecetas } from '../hooks/useRecetas';
import { updateProductoReceta } from '../services/recetas.service';
import type { RecipeIngredient } from '../types/receta.types';

const adminInputClass = '!bg-white !text-central-carbon !placeholder:text-neutral-500 border-neutral-200';

function compatibleUnits(unit: IngredientUnit): IngredientUnit[] {
  if (unit === 'kg' || unit === 'gr') return ['kg', 'gr'];
  if (unit === 'litro' || unit === 'ml') return ['litro', 'ml'];
  return [unit];
}

function quantityInBaseUnit(quantity: number, recipeUnit: IngredientUnit, baseUnit: IngredientUnit) {
  if (recipeUnit === baseUnit) return quantity;
  if (baseUnit === 'kg' && recipeUnit === 'gr') return quantity / 1000;
  if (baseUnit === 'gr' && recipeUnit === 'kg') return quantity * 1000;
  if (baseUnit === 'litro' && recipeUnit === 'ml') return quantity / 1000;
  if (baseUnit === 'ml' && recipeUnit === 'litro') return quantity * 1000;
  return null;
}

function ingredientLineCost(row: RecipeIngredient, ingredient?: Ingredient) {
  if (!ingredient || row.quantity <= 0 || ingredient.unitCost < 0) return null;
  const baseQuantity = quantityInBaseUnit(row.quantity, row.unit, ingredient.unit);
  return baseQuantity === null ? null : baseQuantity * ingredient.unitCost;
}

function recipeCost(rows: RecipeIngredient[], ingredientById: Map<string, Ingredient>) {
  return rows.reduce((total, row) => total + (ingredientLineCost(row, ingredientById.get(row.ingredientId)) ?? 0), 0);
}

function isRecipeCostComplete(rows: RecipeIngredient[], ingredientById: Map<string, Ingredient>) {
  return rows.length > 0 && rows.every((row) => {
    const ingredient = ingredientById.get(row.ingredientId);
    return Boolean(ingredient && row.quantity > 0 && ingredient.unitCost > 0 && ingredientLineCost(row, ingredient) !== null);
  });
}

function profitability(price: number, cost: number) {
  const grossProfit = price - cost;
  const marginPercent = price > 0 ? (grossProfit / price) * 100 : 0;
  const foodCostPercent = price > 0 ? (cost / price) * 100 : 0;
  const markup = cost > 0 ? price / cost : 0;
  return { grossProfit, marginPercent, foodCostPercent, markup };
}

function percent(value: number) {
  return `${value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function targetPrice(cost: number, targetMargin: number) {
  if (cost <= 0 || targetMargin >= 100) return 0;
  return cost / (1 - targetMargin / 100);
}

export function RecetasAdminPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [productId, setProductId] = useState('');
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([]);
  const [ingredientToAdd, setIngredientToAdd] = useState('');
  const [saving, setSaving] = useState(false);

  const { productos, isLoading: productsLoading, error: productsError, refresh: refreshProducts } = useProductos({ active: 'all', available: 'all' });
  const { ingredientes, isLoading: ingredientsLoading, error: ingredientsError, refresh: refreshIngredients } = useIngredientes({ active: 'all' });
  const { categorias, error: categoriesError, refresh: refreshCategories } = useCategorias({ active: 'all' });
  const { recetas, isLoading: recipesLoading, error: recipesError, refresh: refreshRecipes } = useRecetas();

  const ingredientById = useMemo(() => new Map(ingredientes.map((item) => [item.id, item])), [ingredientes]);
  const categoryById = useMemo(() => new Map(categorias.map((item) => [item.id, item])), [categorias]);
  const recipeByProductId = useMemo(() => new Map(recetas.map((item) => [item.productId, item])), [recetas]);

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('es');
    return productos.filter((product) => {
      if (categoryId !== 'all' && product.categoryId !== categoryId) return false;
      if (!normalized) return true;
      const category = categoryById.get(product.categoryId)?.name ?? '';
      return [product.name, product.description, category].some((value) => value.toLocaleLowerCase('es').includes(normalized));
    });
  }, [categoryById, categoryId, productos, search]);

  useEffect(() => {
    if (!productId && filteredProducts[0]) setProductId(filteredProducts[0].id);
    if (productId && !productos.some((product) => product.id === productId)) setProductId(filteredProducts[0]?.id ?? '');
  }, [filteredProducts, productId, productos]);

  const selectedProduct = productos.find((product) => product.id === productId) ?? null;
  const selectedRecipe = productId ? recipeByProductId.get(productId) : undefined;

  useEffect(() => {
    if (!selectedProduct) {
      setDraftIngredients([]);
      return;
    }

    if (selectedRecipe?.ingredients.length) {
      setDraftIngredients(selectedRecipe.ingredients.map((item) => ({ ...item })));
      return;
    }

    setDraftIngredients((selectedProduct.ingredientIds ?? []).map((ingredientId) => ({
      id: `${selectedProduct.id}-${ingredientId}`,
      productId: selectedProduct.id,
      ingredientId,
      quantity: 0,
      unit: ingredientById.get(ingredientId)?.unit ?? 'unidad',
    })));
  }, [ingredientById, selectedProduct, selectedRecipe]);

  const productAnalytics = useMemo(() => productos.map((product) => {
    const rows = recipeByProductId.get(product.id)?.ingredients
      ?? (product.ingredientIds ?? []).map((ingredientId) => ({
        id: `${product.id}-${ingredientId}`,
        productId: product.id,
        ingredientId,
        quantity: 0,
        unit: ingredientById.get(ingredientId)?.unit ?? 'unidad' as IngredientUnit,
      }));
    const cost = recipeCost(rows, ingredientById);
    const complete = isRecipeCostComplete(rows, ingredientById);
    return { product, rows, cost, complete, ...profitability(product.currentPrice, cost) };
  }), [ingredientById, productos, recipeByProductId]);

  const analyticsByProductId = useMemo(() => new Map(productAnalytics.map((item) => [item.product.id, item])), [productAnalytics]);
  const completeAnalytics = productAnalytics.filter((item) => item.complete);
  const averageMargin = completeAnalytics.length ? completeAnalytics.reduce((sum, item) => sum + item.marginPercent, 0) / completeAnalytics.length : 0;
  const averageFoodCost = completeAnalytics.length ? completeAnalytics.reduce((sum, item) => sum + item.foodCostPercent, 0) / completeAnalytics.length : 0;
  const bestMargin = completeAnalytics.length ? [...completeAnalytics].sort((a, b) => b.marginPercent - a.marginPercent)[0] : null;

  const currentCost = recipeCost(draftIngredients, ingredientById);
  const currentComplete = isRecipeCostComplete(draftIngredients, ingredientById);
  const currentProfitability = profitability(selectedProduct?.currentPrice ?? 0, currentCost);
  const selectedIngredientIds = new Set(draftIngredients.map((item) => item.ingredientId));
  const addableIngredients = ingredientes.filter((item) => item.active && !selectedIngredientIds.has(item.id));

  function updateDraftIngredient(id: string, patch: Partial<RecipeIngredient>) {
    setDraftIngredients((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addIngredient() {
    if (!selectedProduct || !ingredientToAdd) return;
    const ingredient = ingredientById.get(ingredientToAdd);
    if (!ingredient) return;
    setDraftIngredients((current) => [...current, {
      id: crypto.randomUUID(),
      productId: selectedProduct.id,
      ingredientId: ingredient.id,
      quantity: 0,
      unit: ingredient.unit,
    }]);
    setIngredientToAdd('');
  }

  async function saveRecipe() {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      await updateProductoReceta({
        productId: selectedProduct.id,
        ingredients: draftIngredients,
        packagingCost: 0,
        extraCost: 0,
      });
      await refreshRecipes();
      toast.success('Receta y costos actualizados correctamente.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la receta.');
    } finally {
      setSaving(false);
    }
  }

  const loading = productsLoading || ingredientsLoading || recipesLoading;
  const error = productsError ?? ingredientsError ?? categoriesError ?? recipesError;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Recetas · Rentabilidad"
        title="Costos y rentabilidad por producto"
        description="Componé cada receta con cantidades reales y compará automáticamente el costo de ingredientes contra el precio de venta."
      />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Productos costeados" value={`${completeAnalytics.length} / ${productos.length}`} helper="con cantidades y costos completos" icon={CheckCircle2} />
        <MetricCard label="Margen bruto promedio" value={completeAnalytics.length ? percent(averageMargin) : '—'} helper="precio menos ingredientes" icon={TrendingUp} />
        <MetricCard label="Food cost promedio" value={completeAnalytics.length ? percent(averageFoodCost) : '—'} helper="ingredientes sobre precio de venta" icon={Beef} />
        <MetricCard label="Mejor margen" value={bestMargin ? percent(bestMargin.marginPercent) : '—'} helper={bestMargin?.product.name ?? 'Sin recetas completas'} icon={BadgeDollarSign} />
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
        <AlertCircle className="mt-0.5 shrink-0" size={18} />
        <p className="text-xs leading-5"><strong>Rentabilidad bruta sobre ingredientes.</strong> El cálculo todavía no descuenta mano de obra, gas, electricidad, impuestos, comisiones de cobro, packaging ni otros costos indirectos.</p>
      </div>

      <div className="mb-5 grid gap-3 rounded-sm border border-neutral-200 bg-white p-4 shadow-soft md:grid-cols-[1fr_260px]">
        <label className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <Input className={`pl-11 ${adminInputClass}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto" />
        </label>
        <Select
          aria-label="Filtrar rentabilidad por categoría"
          variant="light"
          value={categoryId}
          options={[{ value: 'all', label: 'Todas las categorías' }, ...categorias.map((category) => ({ value: category.id, label: category.name }))]}
          onValueChange={setCategoryId}
        />
      </div>

      {error ? (
        <DataLoadError message={error} onRetry={async () => { await Promise.all([refreshProducts(), refreshIngredients(), refreshCategories(), refreshRecipes()]); }} />
      ) : loading ? (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="h-[560px] animate-pulse rounded-sm border border-neutral-200 bg-neutral-100" />
          <div className="h-[560px] animate-pulse rounded-sm border border-neutral-200 bg-neutral-100" />
        </div>
      ) : (
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-sm font-black text-central-carbon">Productos</p>
              <p className="mt-0.5 text-xs text-neutral-500">Seleccioná uno para editar su receta.</p>
            </div>
            <div className="max-h-[720px] space-y-2 overflow-y-auto p-3 custom-scrollbar">
              {filteredProducts.length ? filteredProducts.map((product) => {
                const analytics = analyticsByProductId.get(product.id);
                const active = product.id === productId;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setProductId(product.id)}
                    className={`w-full rounded-sm border p-3 text-left transition ${active ? 'border-central-orange bg-central-orange/[.06] shadow-sm' : 'border-neutral-200 bg-white hover:border-central-orange/35 hover:bg-neutral-50'}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-central-carbon">{product.name}</p>
                            <p className="truncate text-xs text-neutral-500">{categoryById.get(product.categoryId)?.name ?? 'Sin categoría'}</p>
                          </div>
                          <Badge tone={analytics?.complete ? 'success' : 'neutral'}>{analytics?.complete ? 'Costeado' : 'Pendiente'}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <SmallValue label="Venta" value={formatCurrency(product.currentPrice)} />
                          <SmallValue label="Costo" value={analytics?.cost ? formatCurrency(analytics.cost) : '—'} />
                          <SmallValue label="Margen" value={analytics?.complete ? percent(analytics.marginPercent) : '—'} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              }) : <div className="p-8 text-center text-sm text-neutral-500">No hay productos que coincidan con los filtros.</div>}
            </div>
          </section>

          {selectedProduct ? (
            <section className="min-w-0 overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
              <div className="border-b border-neutral-100 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedProduct.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[.12em] text-central-orange">{categoryById.get(selectedProduct.categoryId)?.name ?? 'Producto'}</p>
                      <h2 className="mt-1 truncate text-xl font-black text-central-carbon">{selectedProduct.name}</h2>
                      <p className="mt-1 text-xs text-neutral-500">Definí cantidades y unidades para obtener un costo preciso.</p>
                    </div>
                  </div>
                  <Button onClick={() => void saveRecipe()} disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar receta'}</Button>
                </div>
              </div>

              <div className="grid gap-px border-b border-neutral-100 bg-neutral-100 sm:grid-cols-2 xl:grid-cols-5">
                <ProfitCell label="Precio de venta" value={formatCurrency(selectedProduct.currentPrice)} />
                <ProfitCell label="Costo ingredientes" value={formatCurrency(currentCost)} helper={currentComplete ? 'Costo completo' : 'Faltan datos'} />
                <ProfitCell label="Ganancia bruta/u." value={formatCurrency(currentProfitability.grossProfit)} />
                <ProfitCell label="Margen bruto" value={currentComplete ? percent(currentProfitability.marginPercent) : '—'} />
                <ProfitCell label="Food cost" value={currentComplete ? percent(currentProfitability.foodCostPercent) : '—'} helper={currentComplete && currentProfitability.markup ? `${currentProfitability.markup.toFixed(2)}x sobre costo` : undefined} />
              </div>

              <div className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-central-carbon">Composición de la receta</h3>
                    <p className="mt-1 text-xs text-neutral-500">El costo de cada línea se recalcula usando el costo base del ingrediente.</p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <div className="min-w-0 sm:w-64">
                      <SearchableSelect
                        aria-label="Agregar ingrediente a la receta"
                        value={ingredientToAdd}
                        options={addableIngredients.map((ingredient) => ({ value: ingredient.id, label: ingredient.name }))}
                        onValueChange={setIngredientToAdd}
                        placeholder="Agregar ingrediente"
                        searchPlaceholder="Buscar ingrediente…"
                        emptyMessage="No quedan ingredientes disponibles."
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={addIngredient} disabled={!ingredientToAdd}><Plus size={16} /> Agregar</Button>
                  </div>
                </div>

                {draftIngredients.length ? (
                  <div className="space-y-2">
                    {draftIngredients.map((row) => {
                      const ingredient = ingredientById.get(row.ingredientId);
                      const lineCost = ingredientLineCost(row, ingredient);
                      const unitOptions = compatibleUnits(ingredient?.unit ?? row.unit).map((unit) => ({ value: unit, label: unit }));
                      return (
                        <div key={row.id} className="grid min-w-0 gap-3 rounded-sm border border-neutral-200 bg-neutral-50/50 p-3 md:grid-cols-[minmax(180px,1.4fr)_120px_120px_minmax(140px,.8fr)_minmax(120px,.7fr)_40px] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-central-carbon">{ingredient?.name ?? 'Ingrediente no disponible'}</p>
                            <p className="mt-0.5 text-xs text-neutral-500">{ingredient ? `${formatCurrency(ingredient.unitCost)} por ${ingredient.unit}` : 'Sin costo base'}</p>
                          </div>
                          <label>
                            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-neutral-400 md:hidden">Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              inputMode="decimal"
                              value={row.quantity || ''}
                              onChange={(event) => updateDraftIngredient(row.id, { quantity: Number(event.target.value) })}
                              placeholder="0"
                              className="h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-central-orange focus:ring-2 focus:ring-central-orange/10"
                            />
                          </label>
                          <div>
                            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-neutral-400 md:hidden">Unidad</span>
                            <Select
                              aria-label={`Unidad para ${ingredient?.name ?? 'ingrediente'}`}
                              variant="light"
                              value={row.unit}
                              options={unitOptions}
                              onValueChange={(unit) => updateDraftIngredient(row.id, { unit: unit as IngredientUnit })}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Costo base</p>
                            <p className="mt-1 truncate text-sm font-bold text-neutral-700">{ingredient ? `${formatCurrency(ingredient.unitCost)} / ${ingredient.unit}` : '—'}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Costo en receta</p>
                            <p className={`mt-1 truncate text-sm font-black ${lineCost !== null && lineCost > 0 ? 'text-central-carbon' : 'text-amber-600'}`}>{lineCost !== null && lineCost > 0 ? formatCurrency(lineCost) : 'A definir'}</p>
                          </div>
                          <button type="button" onClick={() => setDraftIngredients((current) => current.filter((item) => item.id !== row.id))} className="grid h-9 w-9 place-items-center rounded-sm text-red-500 transition hover:bg-red-50" aria-label={`Quitar ${ingredient?.name ?? 'ingrediente'}`}><Trash2 size={16} /></button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-sm border border-dashed border-neutral-300 px-5 py-10 text-center">
                    <Beef className="mx-auto text-neutral-300" size={30} />
                    <p className="mt-3 text-sm font-black text-neutral-600">Este producto todavía no tiene receta</p>
                    <p className="mt-1 text-xs text-neutral-400">Agregá ingredientes y sus cantidades para comenzar el análisis.</p>
                  </div>
                )}

                <div className="mt-6 grid gap-3 lg:grid-cols-3">
                  {[40, 50, 60].map((target) => (
                    <div key={target} className="rounded-sm border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">Precio para {target}% de margen</p>
                      <p className="mt-2 text-xl font-black text-central-carbon">{currentComplete ? formatCurrency(targetPrice(currentCost, target)) : '—'}</p>
                      <p className="mt-1 text-xs text-neutral-500">Referencia calculada sólo sobre ingredientes.</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-central-carbon">{value}</p>
          <p className="mt-1 text-xs text-neutral-500">{helper}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><Icon size={17} /></span>
      </div>
    </div>
  );
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">{label}</p><p className="mt-0.5 truncate font-bold text-neutral-700">{value}</p></div>;
}

function ProfitCell({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="bg-white px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">{label}</p>
      <p className="mt-1.5 text-lg font-black text-central-carbon">{value}</p>
      {helper ? <p className="mt-0.5 text-[11px] text-neutral-400">{helper}</p> : null}
    </div>
  );
}
