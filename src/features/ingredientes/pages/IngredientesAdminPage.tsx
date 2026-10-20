'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Package, Plus, RefreshCw, RotateCcw, Search, XCircle } from 'lucide-react';
import type { Ingredient } from '../types/ingrediente.types';
import { IngredienteForm } from '../components/IngredienteForm';
import { IngredienteTable } from '../components/IngredienteTable';
import { IngredienteTableSkeleton } from '../components/IngredienteTableSkeleton';
import { IngredientCostHistoryModal } from '../components/IngredientCostHistoryModal';
import { useIngredienteMutations } from '../hooks/useIngredienteMutations';
import { useIngredientes } from '../hooks/useIngredientes';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { SearchableSelect } from '@/shared/components/ui/SearchableSelect';
import { cn } from '@/shared/utils/cn';
import { Modal } from '@/shared/components/ui/Modal';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

type IngredientFormValues = { name: string; type: Ingredient['type']; unit: Ingredient['unit']; unitCost: number; supplier?: string; active: boolean };
type PendingAction = { title: string; description: string; confirmLabel: string; tone?: 'default' | 'danger'; run: () => Promise<unknown> | unknown };
type CostFilter = 'all' | 'with-cost' | 'without-cost';
type SortOption = 'name-asc' | 'name-desc' | 'cost-desc' | 'cost-asc' | 'updated-desc';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'proteina', label: 'Proteínas' },
  { value: 'panificados', label: 'Panificados' },
  { value: 'lacteos', label: 'Lácteos' },
  { value: 'verduras', label: 'Verduras' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'otros', label: 'Otros' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
] as const;

const COST_OPTIONS = [
  { value: 'all', label: 'Todos los costos' },
  { value: 'with-cost', label: 'Con costo cargado' },
  { value: 'without-cost', label: 'Costo pendiente' },
] as const;

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Nombre A–Z' },
  { value: 'name-desc', label: 'Nombre Z–A' },
  { value: 'cost-desc', label: 'Mayor costo' },
  { value: 'cost-asc', label: 'Menor costo' },
  { value: 'updated-desc', label: 'Últimos actualizados' },
] as const;

const filterClass = '!h-10 !rounded-[11px] !border-neutral-300 !bg-white !text-[12px] !font-normal !shadow-none hover:!border-neutral-400';

function normalizeSearch(text: string) {
  return text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function listSuppliers(ingredients: Ingredient[]) {
  const unique = new Map<string, string>();
  ingredients.forEach((ingredient) => {
    const display = (ingredient.supplier ?? '').trim().replace(/\s+/g, ' ');
    if (!display) return;
    const key = normalizeSearch(display);
    if (!unique.has(key)) unique.set(key, display);
  });
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

export function IngredientesAdminPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Ingredient['type'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [costFilter, setCostFilter] = useState<CostFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOption>('name-asc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [historyIngredient, setHistoryIngredient] = useState<Ingredient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<IngredientFormValues | null>(null);
  // Mantener los proveedores de todos los ingredientes, no solo los filtrados.
  const { ingredientes, isLoading, error, refresh } = useIngredientes({ active: 'all' });
  const mutations = useIngredienteMutations(refresh);

  useEffect(() => {
    document.body.classList.add('catalog-wallet-active');
    return () => document.body.classList.remove('catalog-wallet-active');
  }, []);

  async function confirmAction() {
    if (!pendingAction) return;
    await pendingAction.run();
    setPendingAction(null);
  }

  async function confirmFormSave() {
    if (!pendingFormValues) return;
    if (editing) await mutations.update({ id: editing.id, ...pendingFormValues });
    else await mutations.create(pendingFormValues);
    setPendingFormValues(null);
    setModalOpen(false);
  }

  const suppliers = useMemo(() => listSuppliers(ingredientes), [ingredientes]);
  const supplierChoices = useMemo(() => [
    { value: 'all', label: 'Todos los proveedores' },
    { value: 'none', label: 'Sin proveedor' },
    ...suppliers.map((supplier) => ({ value: supplier, label: supplier })),
  ], [suppliers]);

  const visibleIngredients = useMemo(() => {
    const query = normalizeSearch(search);
    const selectedSupplier = normalizeSearch(supplierFilter);
    return ingredientes.filter((ingredient) => {
      if (query && !normalizeSearch(ingredient.name).includes(query) && !normalizeSearch(ingredient.supplier ?? '').includes(query)) return false;
      if (typeFilter !== 'all' && ingredient.type !== typeFilter) return false;
      if (statusFilter === 'active' && !ingredient.active) return false;
      if (statusFilter === 'inactive' && ingredient.active) return false;
      if (costFilter === 'with-cost' && ingredient.unitCost <= 0) return false;
      if (costFilter === 'without-cost' && ingredient.unitCost > 0) return false;
      if (supplierFilter === 'none' && (ingredient.supplier ?? '').trim()) return false;
      if (supplierFilter !== 'all' && supplierFilter !== 'none' && normalizeSearch(ingredient.supplier ?? '') !== selectedSupplier) return false;
      return true;
    }).sort((a, b) => {
      if (sortOrder === 'name-desc') return b.name.localeCompare(a.name, 'es');
      if (sortOrder === 'cost-desc') return b.unitCost - a.unitCost || a.name.localeCompare(b.name, 'es');
      if (sortOrder === 'cost-asc') return a.unitCost - b.unitCost || a.name.localeCompare(b.name, 'es');
      if (sortOrder === 'updated-desc') return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() || a.name.localeCompare(b.name, 'es');
      return a.name.localeCompare(b.name, 'es');
    });
  }, [ingredientes, search, typeFilter, statusFilter, supplierFilter, costFilter, sortOrder]);

  const activeCount = ingredientes.filter((ingredient) => ingredient.active).length;
  const inactiveCount = ingredientes.length - activeCount;
  const totalPages = Math.max(1, Math.ceil(visibleIngredients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstItem = visibleIngredients.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(currentPage * pageSize, visibleIngredients.length);
  const displayedIngredients = visibleIngredients.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + index,
  );
  const hasFilters = Boolean(search.trim()) || typeFilter !== 'all' || statusFilter !== 'all' ||
    supplierFilter !== 'all' || costFilter !== 'all';

  function resetPage() { setPage(1); }

  function clearFilters() {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setSupplierFilter('all');
    setCostFilter('all');
    setPage(1);
  }

  return (
    <div className="catalog-wallet min-w-0 pb-8">
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Ingredientes base</h1>
          <p className="mt-1 text-[13px] leading-5 text-neutral-500">Administrá los ingredientes que utilizás al crear tus productos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            aria-label="Actualizar ingredientes"
            title="Actualizar ingredientes"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border border-neutral-200 bg-white text-neutral-600 transition duration-200 hover:bg-neutral-50 hover:text-neutral-900 active:scale-[.97] disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Button size="sm" className="!h-9 !rounded-[11px] !bg-[#191b20] !px-3 !text-[12px] !font-medium !shadow-none transition duration-200 hover:!bg-neutral-700 active:scale-[.98]" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={16} strokeWidth={1.9} /> Nuevo ingrediente
          </Button>
        </div>
      </div>

      <section aria-label="Resumen de ingredientes" className="relative mb-5 flex min-w-0 flex-col overflow-hidden rounded-[23px] bg-[#191b20] p-5 text-white shadow-soft sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <span className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-central-orange/10 blur-[60px]" aria-hidden="true" />
        <div className="relative min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-white/10 bg-white/[.08]"><Package size={18} strokeWidth={1.7} className="text-white/80" /></span>
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/45">Tu inventario base</span>
          </div>
          <p className="mt-5 text-[12px] text-white/60">Ingredientes registrados</p>
          <p className="mt-1 text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-[-.055em] tabular-nums">{isLoading ? '—' : ingredientes.length.toLocaleString('es-AR')}</p>
          <p className="mt-2 text-[11px] text-white/40">Total de ingredientes, sin aplicar filtros.</p>
        </div>
        <div className="relative mt-6 grid min-w-0 grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:max-w-[440px] lg:mt-0 lg:w-[44%] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <div className="flex items-center gap-1.5 text-white/55"><CheckCircle2 size={14} strokeWidth={1.8} className="text-emerald-300" /><span className="text-[11px]">Activos</span></div>
            <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-.045em] tabular-nums text-[#c7f0d7]">{isLoading ? '—' : activeCount}</p>
          </div>
          <div className="border-l border-white/10 pl-4">
            <div className="flex items-center gap-1.5 text-white/55"><XCircle size={14} strokeWidth={1.8} className="text-white/60" /><span className="text-[11px]">Inactivos</span></div>
            <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-.045em] tabular-nums text-white/80">{isLoading ? '—' : inactiveCount}</p>
          </div>
        </div>
      </section>

      <section aria-label="Buscar y filtrar ingredientes" className="mb-5 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Buscar y filtrar ingredientes</h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">Encontrá rápidamente insumos por nombre, proveedor, tipo o estado.</p>
          </div>
          {hasFilters ? (
            <button type="button" onClick={clearFilters}
              className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
              aria-label="Limpiar todos los filtros">
              <RotateCcw size={13} /> Limpiar filtros
            </button>
          ) : null}
        </div>
        <label className="relative mb-3 block w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} strokeWidth={1.8} />
          <Input
            className="!h-10 !rounded-[11px] !border-neutral-300 !bg-white !pl-10 !pr-3 !text-[12px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 hover:!border-neutral-400 focus:!border-central-orange/70"
            value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }}
            placeholder="Nombre del ingrediente o proveedor..."
            aria-label="Buscar por ingrediente o proveedor"
          />
        </label>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="min-w-0">
            <span className="mb-1.5 block text-[10px] font-medium text-neutral-500">Tipo</span>
            <Select variant="light" aria-label="Filtrar por tipo" value={typeFilter} options={TYPE_OPTIONS}
              onValueChange={value => { setTypeFilter(value as Ingredient['type'] | 'all'); resetPage(); }}
              className={filterClass}/>
          </label>
          <div className="min-w-0">
            <span className="mb-1.5 block text-[10px] font-medium text-neutral-500">Proveedor</span>
            <SearchableSelect aria-label="Filtrar por proveedor" value={supplierFilter}
              options={supplierChoices} onValueChange={value => { setSupplierFilter(value); resetPage(); }}
              placeholder="Todos los proveedores" searchPlaceholder="Buscar proveedor..."
              emptyMessage="No se encontró el proveedor" className={filterClass}/>
          </div>
          <label className="min-w-0">
            <span className="mb-1.5 block text-[10px] font-medium text-neutral-500">Estado</span>
            <Select variant="light" aria-label="Filtrar por estado" value={statusFilter} options={STATUS_OPTIONS}
              onValueChange={value => { setStatusFilter(value as 'all' | 'active' | 'inactive'); resetPage(); }}
              className={filterClass}/>
          </label>
          <label className="min-w-0">
            <span className="mb-1.5 block text-[10px] font-medium text-neutral-500">Costo base</span>
            <Select variant="light" aria-label="Filtrar por costo" value={costFilter} options={COST_OPTIONS}
              onValueChange={value => { setCostFilter(value as CostFilter); resetPage(); }}
              className={filterClass}/>
          </label>
        </div>
      </section>

      <div className="mb-3 flex min-w-0 flex-col gap-3 px-0.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-.035em] text-neutral-950">Listado de ingredientes</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {isLoading ? 'Actualizando datos…' : visibleIngredients.length.toLocaleString('es-AR') + ' de ' + ingredientes.length.toLocaleString('es-AR') + ' ingredientes'}
          </p>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          {hasFilters && !isLoading ? (
            <span className="hidden shrink-0 rounded-full bg-central-orange/10 px-3 py-1.5 text-[11px] font-medium text-central-ember lg:inline-flex">
              Filtros activos
            </span>
          ) : null}
          <span className="shrink-0 text-[11px] text-neutral-500">Ordenar</span>
          <div className="min-w-0 flex-1 sm:w-[198px]">
            <Select variant="light" aria-label="Ordenar ingredientes" value={sortOrder} options={SORT_OPTIONS}
              onValueChange={value => { setSortOrder(value as SortOption); resetPage(); }}
              className={filterClass}/>
          </div>
        </div>
      </div>

      {error
        ? <DataLoadError message={error} onRetry={refresh} />
        : isLoading
          ? <IngredienteTableSkeleton />
          : <IngredienteTable
              ingredients={displayedIngredients}
              onEdit={(ing) => { setEditing(ing); setModalOpen(true); }}
              onHistory={setHistoryIngredient}
              onDelete={(id) => setPendingAction({ title: 'Eliminar ingrediente', description: '¿Seguro que querés eliminar este ingrediente? Ya no aparecerá como chip disponible para nuevos productos.', confirmLabel: 'Eliminar', tone: 'danger', run: () => mutations.remove(id) })}
              onToggleActive={(id) => setPendingAction({ title: 'Cambiar estado de ingrediente', description: '¿Seguro que querés activar o desactivar este ingrediente?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleActive(id) })}
            />}

      {!error && !isLoading && visibleIngredients.length > 0 ? (
        <nav aria-label="Paginación de ingredientes" className="mt-5 flex min-w-0 flex-col gap-3 rounded-[16px] border border-neutral-200/70 bg-white px-4 py-3 shadow-[0_5px_18px_rgba(15,23,42,.025)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <p className="whitespace-nowrap text-[11px] text-neutral-500">
              Mostrando <strong className="font-semibold tabular-nums text-neutral-800">{firstItem}–{lastItem}</strong> de <strong className="font-semibold tabular-nums text-neutral-800">{visibleIngredients.length}</strong>
            </p>
            <span className="hidden text-neutral-300 sm:inline">·</span>
            <span className="text-[11px] text-neutral-500">Filas</span>
            <div className="w-[80px]">
              <Select variant="light" aria-label="Filas por página" value={String(pageSize)}
                options={PAGE_SIZE_OPTIONS.map(size => ({ value: String(size), label: String(size) }))}
                onValueChange={value => { setPageSize(Number(value)); resetPage(); }}
                className="!h-8 !rounded-[9px] !border-neutral-300 !bg-white !px-2 !text-[11px] !shadow-none"/>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" title="Página anterior" aria-label="Página anterior"
              disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}
              className="grid h-8 w-8 place-items-center rounded-[9px] border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35">
              <ChevronLeft size={16}/>
            </button>
            {pageNumbers.map(number => (
              <button key={number} type="button" aria-label={'Página ' + number} aria-current={currentPage === number ? 'page' : undefined}
                onClick={() => setPage(number)}
                className={cn('grid h-8 min-w-8 place-items-center rounded-[9px] border px-1.5 text-[11px] font-semibold tabular-nums transition-colors',
                  currentPage === number ? 'border-[#191b20] bg-[#191b20] text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50')}>
                {number}
              </button>
            ))}
            <button type="button" title="Página siguiente" aria-label="Página siguiente"
              disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}
              className="grid h-8 w-8 place-items-center rounded-[9px] border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35">
              <ChevronRight size={16}/>
            </button>
          </div>
        </nav>
      ) : null}

      <IngredientCostHistoryModal ingredient={historyIngredient} onClose={() => setHistoryIngredient(null)} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'} theme="light" panelClassName="!rounded-[20px] !border-neutral-200/80 !bg-white">
        <IngredienteForm key={editing?.id ?? 'new'} ingredient={editing} suppliers={suppliers} isSaving={mutations.isSaving} onCancel={() => setModalOpen(false)} onSubmit={(values) => setPendingFormValues(values)} />
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description ?? ''}
        confirmLabel={pendingAction?.confirmLabel}
        tone={pendingAction?.tone}
        theme="light"
        isLoading={mutations.isSaving}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
      <ConfirmDialog
        open={Boolean(pendingFormValues)}
        title={editing ? 'Guardar cambios de ingrediente' : 'Crear ingrediente'}
        description={editing ? '¿Seguro que querés guardar los cambios? El costo base se reflejará en las recetas asociadas, pero no cambiará los precios de venta.' : '¿Seguro que querés crear este ingrediente?'}
        confirmLabel={editing ? 'Guardar cambios' : 'Crear ingrediente'}
        theme="light"
        isLoading={mutations.isSaving}
        onCancel={() => setPendingFormValues(null)}
        onConfirm={confirmFormSave}
      />
    </div>
  );
}
