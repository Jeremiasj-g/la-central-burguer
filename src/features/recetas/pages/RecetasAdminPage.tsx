'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeDollarSign,
  Beef,
  CheckCircle2,
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
import { SearchableSelect } from '@/shared/components/ui/SearchableSelect';
import { Select } from '@/shared/components/ui/Select';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';
import { formatCurrency } from '@/shared/utils/format.utils';
import { cn } from '@/shared/utils/cn';
import { useRecetas } from '../hooks/useRecetas';
import { updateProductoReceta } from '../services/recetas.service';
import type { RecipeIngredient } from '../types/receta.types';
import { RentabilidadOverview } from '../components/RentabilidadOverview';
import styles from './RecetasAdminPage.module.css';
import { useAdminUnsavedChanges } from '@/shared/components/layout/AdminUnsavedChanges';

const adminInputClass = '!h-10 !rounded-[11px] !border-neutral-300 !bg-white !px-3 !text-[13px] !font-normal !text-neutral-800 !shadow-none !placeholder:text-neutral-400 transition-all duration-200 hover:!border-neutral-400 focus:!border-[#d99536] focus:!bg-white focus:!ring-2 focus:!ring-[#d99536]/10';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'editor'>('overview');
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
  const filteredProductIds = useMemo(() => new Set(filteredProducts.map((product) => product.id)), [filteredProducts]);
  const overviewRows = useMemo(() => productAnalytics.filter(({ product }) => filteredProductIds.has(product.id)), [productAnalytics, filteredProductIds]);
  const completeAnalytics = productAnalytics.filter((item) => item.complete);
  const averageMargin = completeAnalytics.length ? completeAnalytics.reduce((sum, item) => sum + item.marginPercent, 0) / completeAnalytics.length : 0;
  const averageFoodCost = completeAnalytics.length ? completeAnalytics.reduce((sum, item) => sum + item.foodCostPercent, 0) / completeAnalytics.length : 0;
  const bestMargin = completeAnalytics.length ? [...completeAnalytics].sort((a, b) => b.marginPercent - a.marginPercent)[0] : null;

  const currentCost = recipeCost(draftIngredients, ingredientById);
  const currentComplete = isRecipeCostComplete(draftIngredients, ingredientById);
  const currentProfitability = profitability(selectedProduct?.currentPrice ?? 0, currentCost);
  const savedRows = selectedRecipe?.ingredients?.length
    ? selectedRecipe.ingredients
    : (selectedProduct?.ingredientIds ?? []).map(id => ({
        ingredientId: id, quantity: 0, unit: ingredientById.get(id)?.unit ?? 'unidad',
      }));
  const fingerprint = (rows: { ingredientId: string; quantity: number; unit: IngredientUnit }[]) =>
    JSON.stringify(rows.map(row => ({ ingredientId: row.ingredientId, quantity: row.quantity, unit: row.unit })).sort((a,b) => a.ingredientId.localeCompare(b.ingredientId)));
  const hasRecipeChanges = Boolean(selectedProduct && fingerprint(draftIngredients) !== fingerprint(savedRows));
  const requestNavigation = useAdminUnsavedChanges(hasRecipeChanges);
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
    if (!selectedProduct || !hasRecipeChanges || saving) return;
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
    <div className="catalog-wallet min-w-0 pb-8">
      <header className="mb-6 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">
            Costos y rentabilidad
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-neutral-500">
            Gestioná las cantidades de cada receta y analizá sus costos frente al precio de venta.
          </p>
        </div>
        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-3 py-2 text-[11px] font-medium text-neutral-500 shadow-[0_2px_8px_rgba(17,24,39,.025)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Análisis por producto
        </div>
      </header>

      <nav aria-label="Vistas de recetas y rentabilidad" className="mb-6 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-[13px] border border-neutral-200/80 bg-white p-1 shadow-[0_3px_12px_rgba(17,24,39,.035)]">
        <button
          type="button"
          aria-current={activeTab === 'overview' ? 'page' : undefined}
          onClick={() => requestNavigation(() => setActiveTab('overview'))}
          className={cn('inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[12px] font-semibold transition-colors duration-200 sm:px-4', activeTab === 'overview' ? 'bg-[#191b20] text-white shadow-[0_3px_8px_rgba(0,0,0,.12)]' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900')}
        >
          Análisis general
        </button>
        <button
          type="button"
          aria-current={activeTab === 'editor' ? 'page' : undefined}
          onClick={() => setActiveTab('editor')}
          className={cn('inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[12px] font-semibold transition-colors duration-200 sm:px-4', activeTab === 'editor' ? 'bg-[#191b20] text-white shadow-[0_3px_8px_rgba(0,0,0,.12)]' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900')}
        >
          Editor de recetas
        </button>
      </nav>

      <section aria-label="Indicadores de rentabilidad" className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative flex min-h-[156px] min-w-0 flex-col justify-between overflow-hidden rounded-[20px] bg-[#191b20] p-5 text-white shadow-[0_12px_30px_rgba(17,24,39,.10)]">
          <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[#e9a349]/[.13] blur-[38px]" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <p className="text-[12px] font-medium text-white/60">Margen bruto promedio</p>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/[.075] text-[#f5b55a]">
              <TrendingUp size={17} strokeWidth={1.8} />
            </span>
          </div>
          <div className="relative mt-3">
            <p className="break-words text-[clamp(2rem,3vw,2.5rem)] font-semibold leading-none tracking-[-.055em] tabular-nums">
              {completeAnalytics.length ? percent(averageMargin) : '—'}
            </p>
            <p className="mt-2 text-[11px] leading-4 text-white/45">Precio de venta menos costo de ingredientes</p>
          </div>
        </div>
        <MetricCard label="Productos costeados" value={String(completeAnalytics.length) + ' / ' + String(productos.length)} helper="Con cantidades y costos completos" icon={CheckCircle2} />
        <MetricCard label="Food cost promedio" value={completeAnalytics.length ? percent(averageFoodCost) : '—'} helper="Participación de ingredientes en el precio" icon={Beef} />
        <MetricCard label="Mejor margen" value={bestMargin ? percent(bestMargin.marginPercent) : '—'} helper={bestMargin?.product.name ?? 'Sin recetas completas'} icon={BadgeDollarSign} />
      </section>

      <div className="mb-6 flex items-start gap-2.5 rounded-[13px] border border-[#eedfc6] bg-[#fbf7ef] px-3.5 py-3 text-[#806135] sm:px-4">
        <AlertCircle className="mt-0.5 shrink-0" size={16} strokeWidth={1.8} />
        <p className="text-[11px] leading-[1.65]">
          <strong className="font-semibold">Los márgenes son brutos.</strong> Solo contemplan ingredientes; no incluyen mano de obra,
          gas, electricidad, impuestos, comisiones, packaging ni otros gastos indirectos.
        </p>
      </div>

      <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-[440px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-neutral-400" size={17} strokeWidth={1.8} />
          <Input
            aria-label="Buscar producto"
            className={adminInputClass + ' !pl-10'}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar productos..."
          />
        </div>
        <div className="w-full min-w-0 sm:w-[240px]">
          <Select
            aria-label="Filtrar rentabilidad por categoría"
            variant="light"
            className="!h-10 !rounded-[11px] !border-neutral-300 !bg-white !text-[13px] !font-normal !shadow-none"
            value={categoryId}
            options={[{ value: 'all', label: 'Todas las categorías' }, ...categorias.map((category) => ({ value: category.id, label: category.name }))]}
            onValueChange={setCategoryId}
          />
        </div>
      </div>

      {error ? (
        <DataLoadError
          message={error}
          onRetry={async () => { await Promise.all([refreshProducts(), refreshIngredients(), refreshCategories(), refreshRecipes()]); }}
        />
      ) : loading ? (
        <div className={cn('grid min-w-0 gap-4', activeTab === 'editor' && 'xl:grid-cols-[330px_minmax(0,1fr)]')}>
          <div className="h-[390px] animate-pulse rounded-[20px] border border-neutral-200/70 bg-white/80" />
          {activeTab === 'editor' ? <div className="h-[540px] animate-pulse rounded-[20px] border border-neutral-200/70 bg-white/80" /> : null}
        </div>
      ) : activeTab === 'overview' ? (
        <RentabilidadOverview
          items={overviewRows}
          categoryById={categoryById}
          onEdit={(id) => {
            requestNavigation(() => { setProductId(id); setActiveTab('editor'); });
          }}
        />
      ) : (
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[330px_minmax(0,1fr)] 2xl:grid-cols-[350px_minmax(0,1fr)]">
          <section aria-label="Listado de productos" className="min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,.035)]">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Productos</h2>
                <p className="mt-0.5 text-[11px] text-neutral-400">Seleccioná una receta para editarla</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-neutral-500">
                {filteredProducts.length}
              </span>
            </div>
            <div className="custom-scrollbar max-h-[600px] space-y-1 overflow-y-auto p-2.5 xl:max-h-[800px]">
              {filteredProducts.length ? filteredProducts.map((product) => {
                const analytics = analyticsByProductId.get(product.id);
                const active = product.id === productId;
                return (
                  <button key={product.id} type="button" aria-pressed={active}
                    onClick={() => requestNavigation(() => setProductId(product.id))}
                    className={cn(
                      'group relative block w-full min-w-0 rounded-[13px] px-3 py-3 text-left outline-offset-2 transition-[background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-[#d99536]',
                      active ? 'bg-[#fcf5e9]' : 'hover:bg-[#f7f7f8]',
                    )}>
                    {active ? <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-[#d99536]" /> : null}
                    <div className="flex min-w-0 gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[11px] bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold leading-5 text-neutral-900">{product.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-neutral-400">{categoryById.get(product.categoryId)?.name ?? 'Sin categoría'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-medium', analytics?.complete ? 'text-emerald-700' : 'text-amber-700')}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', analytics?.complete ? 'bg-emerald-500' : 'bg-amber-400')} />
                            {analytics?.complete ? 'Costeado' : 'Pendiente'}
                          </span>
                          {analytics?.complete ? <span className="text-[10px] font-medium text-neutral-500">Margen {percent(analytics.marginPercent)}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-200/60 pt-2.5">
                      <SmallValue label="Precio de venta" value={formatCurrency(product.currentPrice)} />
                      <SmallValue label="Costo receta" value={analytics?.cost ? formatCurrency(analytics.cost) : '—'} />
                    </div>
                  </button>
                );
              }) : (
                <div className="px-4 py-12 text-center">
                  <Search size={23} className="mx-auto text-neutral-300" />
                  <p className="mt-3 text-[13px] font-medium text-neutral-700">Sin coincidencias</p>
                  <p className="mt-1 text-[11px] text-neutral-400">Probá con otro nombre o categoría.</p>
                </div>
              )}
            </div>
          </section>

          {selectedProduct ? (
            <section aria-label="Editor de rentabilidad de receta" className="min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,.035)]">
              <div className="flex min-w-0 flex-col gap-4 border-b border-neutral-100 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[13px] bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedProduct.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-[#bd7e26]">{categoryById.get(selectedProduct.categoryId)?.name ?? 'Producto'}</p>
                    <h2 className="mt-0.5 break-words text-[18px] font-semibold leading-[1.2] tracking-[-.035em] text-neutral-950 sm:text-[20px]">{selectedProduct.name}</h2>
                    <p className="mt-1 text-[11px] text-neutral-400">Editá cantidades y unidades de la receta</p>
                  </div>
                </div>
                <Button type="button" onClick={() => void saveRecipe()} disabled={saving || !hasRecipeChanges}
                  className="!h-10 !w-full !rounded-[11px] !bg-[#eaa42f] !px-4 !text-[12px] !font-semibold !text-[#211a12] !shadow-none hover:!bg-[#f0b64d] sm:!w-auto">
                  <Save size={15} strokeWidth={1.9} /> {saving ? 'Guardando...' : 'Guardar receta'}
                </Button>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-px border-b border-neutral-100 bg-neutral-100 md:grid-cols-3 2xl:grid-cols-5">
                <ProfitCell label="Precio de venta" value={formatCurrency(selectedProduct.currentPrice)} />
                <ProfitCell label="Costo ingredientes" value={formatCurrency(currentCost)} helper={currentComplete ? 'Costo completo' : 'Parcial · faltan datos'} />
                <ProfitCell label="Ganancia bruta / u." value={currentComplete ? formatCurrency(currentProfitability.grossProfit) : "—"} />
                <ProfitCell label="Margen bruto" value={currentComplete ? percent(currentProfitability.marginPercent) : '—'} highlight />
                <ProfitCell label="Food cost" value={currentComplete ? percent(currentProfitability.foodCostPercent) : '—'} helper={currentComplete && currentProfitability.markup ? currentProfitability.markup.toFixed(2) + 'x sobre costo' : undefined} />
              </div>

              <div className="px-4 py-5 sm:px-6 sm:py-6">
                <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Ingredientes de la receta</h3>
                    <p className="mt-1 text-[11px] leading-5 text-neutral-500">Los costos se actualizan al cambiar cantidades y unidades.</p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 sm:w-[210px]">
                      <SearchableSelect
                        aria-label="Agregar ingrediente a la receta"
                        className="!h-10 !rounded-[11px] !border-neutral-300 !bg-white !text-[13px] !font-normal !shadow-none"
                        value={ingredientToAdd}
                        options={addableIngredients.map((ingredient) => ({ value: ingredient.id, label: ingredient.name }))}
                        onValueChange={setIngredientToAdd}
                        placeholder="Elegir ingrediente"
                        searchPlaceholder="Buscar ingrediente..."
                        emptyMessage="No quedan ingredientes disponibles."
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={addIngredient} disabled={!ingredientToAdd}
                      className="!h-10 !rounded-[11px] !border-neutral-200 !px-3 !text-[12px] !font-medium !shadow-none">
                      <Plus size={15} strokeWidth={1.9} /> Agregar
                    </Button>
                  </div>
                </div>

                {draftIngredients.length ? (
                  <div className={styles.recipeLedger}>
                    <div aria-hidden="true" className={styles.recipeHeader}>
                      <span>Ingrediente</span>
                      <span>Cantidad</span>
                      <span>Unidad</span>
                      <span>Costo base</span>
                      <span>Costo en receta</span>
                      <span />
                    </div>
                    <div className={styles.recipeRows}>
                      {draftIngredients.map((row) => {
                        const ingredient = ingredientById.get(row.ingredientId);
                        const lineCost = ingredientLineCost(row, ingredient);
                        const unitOptions = compatibleUnits(ingredient?.unit ?? row.unit).map((unit) => ({ value: unit, label: unit }));
                        const ingredientName = ingredient?.name ?? 'Ingrediente no disponible';

                        return (
                          <div key={row.id} className={styles.recipeRow}>
                            <div className={styles.ingredient}>
                              <p className={styles.ingredientName} title={ingredientName}>{ingredientName}</p>
                              <p className={styles.ingredientHint}>
                                {ingredient ? formatCurrency(ingredient.unitCost) + ' / ' + ingredient.unit : 'Sin costo base'}
                              </p>
                            </div>

                            <div className={styles.recipeFields}>
                              <label className={styles.quantityField}>
                                <span className={styles.fieldLabel}>Cantidad</span>
                                <Input
                                  aria-label={'Cantidad de ' + ingredientName}
                                  type="number" min="0" step="0.001" inputMode="decimal"
                                  value={row.quantity || ''}
                                  onChange={(event) => updateDraftIngredient(row.id, { quantity: Number(event.target.value) })}
                                  placeholder="0"
                                  className={adminInputClass + ' !h-9 !bg-white'}
                                />
                              </label>
                              <div className={styles.unitField}>
                                <span className={styles.fieldLabel}>Unidad</span>
                                <Select
                                  aria-label={'Unidad para ' + ingredientName}
                                  variant="light" value={row.unit} options={unitOptions}
                                  className="!h-9 !rounded-[10px] !border-neutral-300 !bg-white !text-[12px] !font-normal !shadow-none"
                                  onValueChange={(unit) => updateDraftIngredient(row.id, { unit: unit as IngredientUnit })}
                                />
                              </div>
                              <div className={styles.baseCostField}>
                                <span className={styles.fieldLabel}>Costo base</span>
                                <p className={styles.baseCostValue}>
                                  {ingredient ? formatCurrency(ingredient.unitCost) + ' / ' + ingredient.unit : '—'}
                                </p>
                              </div>
                              <div className={styles.lineCostField}>
                                <span className={styles.fieldLabel}>Costo en receta</span>
                                <p className={cn(styles.lineCostValue, !(lineCost !== null && lineCost > 0) && styles.pendingCost)}>
                                  {lineCost !== null && lineCost > 0 ? formatCurrency(lineCost) : 'A definir'}
                                </p>
                              </div>
                            </div>

                            <button type="button"
                              onClick={() => setDraftIngredients((current) => current.filter((item) => item.id !== row.id))}
                              aria-label={'Quitar ' + ingredientName}
                              title={'Quitar ' + ingredientName}
                              className={styles.removeButton}>
                              <Trash2 size={15} strokeWidth={1.8} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[15px] border border-dashed border-neutral-200 bg-[#fafafb] px-5 py-10 text-center">
                    <Beef className="mx-auto text-neutral-300" size={28} strokeWidth={1.7} />
                    <p className="mt-3 text-[13px] font-semibold text-neutral-700">Este producto todavía no tiene receta</p>
                    <p className="mt-1 text-[11px] text-neutral-400">Agregá ingredientes para comenzar el cálculo.</p>
                  </div>
                )}

                <div className="mt-7 border-t border-neutral-100 pt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold text-neutral-900">Precios de referencia</h3>
                      <p className="mt-1 text-[11px] text-neutral-500">Precio sugerido para distintos márgenes brutos</p>
                    </div>
                    <span className="rounded-full bg-[#f7f7f8] px-2.5 py-1 text-[10px] font-medium text-neutral-500">Solo ingredientes</span>
                  </div>
                  <div className="grid min-w-0 gap-2.5 sm:grid-cols-3">
                    {[40, 50, 60].map((target) => (
                      <div key={target} className="min-w-0 rounded-[13px] bg-[#f6f6f7] p-3.5 sm:p-4">
                        <p className="text-[11px] font-medium text-neutral-500">{target}% de margen</p>
                        <p className="mt-2 break-words text-[clamp(1rem,2vw,1.3rem)] font-semibold leading-tight tracking-[-.035em] tabular-nums text-neutral-900">
                          {currentComplete ? formatCurrency(targetPrice(currentCost, target)) : '—'}
                        </p>
                        <p className="mt-2 text-[10px] text-neutral-400">Precio orientativo</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="rounded-[20px] border border-neutral-200/70 bg-white px-6 py-14 text-center">
              <Beef className="mx-auto text-neutral-300" size={27} />
              <p className="mt-3 text-[13px] font-medium text-neutral-700">Seleccioná un producto</p>
              <p className="mt-1 text-[11px] text-neutral-400">Elegí una receta del listado para ver sus costos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <article className="flex min-h-[156px] min-w-0 flex-col justify-between rounded-[20px] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.035)]">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[12px] font-medium text-neutral-500">{label}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#f6f6f7] text-[#b47a31]">
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <p className="break-words text-[clamp(1.5rem,2.25vw,1.95rem)] font-semibold leading-none tracking-[-.05em] tabular-nums text-neutral-950">{value}</p>
        <p className="mt-2 truncate text-[11px] leading-4 text-neutral-400" title={helper}>{helper}</p>
      </div>
    </article>
  );
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-[12px] font-semibold tabular-nums text-neutral-800" title={value}>{value}</p>
    </div>
  );
}

function ProfitCell({ label, value, helper, highlight = false }: { label: string; value: string; helper?: string; highlight?: boolean }) {
  return (
    <div className={cn('min-w-0 bg-white px-3 py-4 sm:px-4', highlight && 'bg-[#fffaf1]')}>
      <p className="text-[10px] font-medium leading-4 text-neutral-500">{label}</p>
      <p className={cn('mt-1.5 break-words text-[clamp(1rem,1.45vw,1.3rem)] font-semibold leading-tight tracking-[-.035em] tabular-nums', highlight ? 'text-[#b77922]' : 'text-neutral-900')}>{value}</p>
      {helper ? <p className="mt-1 text-[10px] leading-4 text-neutral-400">{helper}</p> : null}
    </div>
  );
}
