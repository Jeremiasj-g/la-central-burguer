'use client';
// Verificación CI temporal del filtro de estado de productos.

import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, Package, Plus, RefreshCw, Search, Star, XCircle } from 'lucide-react';
import type { Product } from '../types/producto.types';
import { ProductoForm } from '../components/ProductoForm';
import { ProductoTable } from '../components/ProductoTable';
import { ProductoTableSkeleton } from '../components/ProductoTableSkeleton';
import { useProductoMutations } from '../hooks/useProductoMutations';
import { useProductos } from '../hooks/useProductos';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { useIngredientes } from '@/features/ingredientes/hooks/useIngredientes';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Modal } from '@/shared/components/ui/Modal';
import { Select } from '@/shared/components/ui/Select';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

type ProductFormValues = {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  currentPrice: number;
  active: boolean;
  available: boolean;
  featured: boolean;
  isPromotion: boolean;
  ingredientIds: string[];
};

type PendingAction = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  run: () => Promise<unknown> | unknown;
};

export function ProductosAdminPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<ProductFormValues | null>(null);
  const { categorias, error: categoriesError, refresh: refreshCategories } = useCategorias({ active: 'all' });
  const { ingredientes, error: ingredientsError, refresh: refreshIngredients } = useIngredientes({ active: 'active' });
  const { productos, isLoading, error: productsError, refresh } = useProductos({ search, categoryId, active: activeStatus, available: 'all' });
  const mutations = useProductoMutations(refresh);

  useEffect(() => {
    document.body.classList.add('products-wallet-active');
    return () => document.body.classList.remove('products-wallet-active');
  }, []);

  function requestAction(action: PendingAction) {
    setPendingAction(action);
  }

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

  const activeCount = productos.filter((product) => product.active).length;
  const availableCount = productos.filter((product) => product.available).length;
  const featuredCount = productos.filter((product) => product.featured).length;
  const hasFilters = Boolean(search.trim()) || categoryId !== 'all' || activeStatus !== 'all';

  return (
    <div className="products-wallet min-w-0 pb-8">
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Gestión de productos</h1>
          <p className="mt-1 text-[13px] leading-5 text-neutral-500">
            Administrá tu catálogo, precios y disponibilidad desde un mismo lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            title="Actualizar productos"
            aria-label="Actualizar productos"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border border-neutral-200 bg-white text-neutral-600 transition duration-200 hover:bg-neutral-50 hover:text-neutral-900 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} strokeWidth={1.8} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Button
            size="sm"
            className="!h-9 !rounded-[11px] !bg-[#191b20] !px-3 !text-[12px] !font-medium !shadow-none transition duration-200 hover:!bg-neutral-700 active:scale-[.98]"
            onClick={() => { setEditing(null); setModalOpen(true); }}
          >
            <Plus size={16} strokeWidth={1.9} /> Nuevo producto
          </Button>
        </div>
      </div>

      <section aria-label="Resumen del catálogo" className="relative mb-5 flex min-w-0 flex-col overflow-hidden rounded-[23px] bg-[#191b20] p-5 text-white shadow-soft sm:p-6 xl:flex-row xl:items-end xl:justify-between">
        <span className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-central-orange/10 blur-[60px]" aria-hidden="true" />
        <div className="relative min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-white/10 bg-white/[.08]">
              <Package size={18} strokeWidth={1.7} className="text-white/80" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/45">Tu catálogo</span>
          </div>
          <p className="mt-5 text-[12px] text-white/60">Productos en la vista actual</p>
          <p className="mt-1 text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-[-.055em] tabular-nums">
            {isLoading ? '—' : productos.length.toLocaleString('es-AR')}
          </p>
          <p className="mt-2 text-[11px] text-white/40">Los indicadores reflejan la búsqueda, categoría y estado seleccionados.</p>
        </div>
        <div className="relative mt-6 grid min-w-0 grid-cols-3 gap-2 border-t border-white/10 pt-5 sm:max-w-[520px] sm:gap-4 xl:mt-0 xl:w-[52%] xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-white/55">
              <CheckCircle2 size={14} strokeWidth={1.8} className="shrink-0 text-emerald-300" />
              <span className="text-[11px]">Activos</span>
            </div>
            <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-.045em] tabular-nums text-[#c7f0d7]">{isLoading ? '—' : activeCount}</p>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-3 sm:pl-4">
            <div className="flex items-center gap-1.5 text-white/55">
              <Eye size={14} strokeWidth={1.8} className="shrink-0 text-sky-300" />
              <span className="text-[11px]">Disponibles</span>
            </div>
            <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-.045em] tabular-nums text-white/85">{isLoading ? '—' : availableCount}</p>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-3 sm:pl-4">
            <div className="flex items-center gap-1.5 text-white/55">
              <Star size={14} strokeWidth={1.8} className="shrink-0 text-amber-300" />
              <span className="text-[11px]">Destacados</span>
            </div>
            <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-.045em] tabular-nums text-white/85">{isLoading ? '—' : featuredCount}</p>
          </div>
        </div>
      </section>

      <section aria-label="Filtros de productos" className="mb-5 min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Encontrá un producto</h2>
          <p className="mt-0.5 text-[11px] leading-5 text-neutral-500">Buscá por nombre o filtrá por categoría y estado.</p>
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_200px]">
          <label className="min-w-0 md:col-span-2 xl:col-span-1">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Buscar</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} strokeWidth={1.8} />
              <Input
                className="!h-10 !w-full !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !pl-10 !pr-3 !text-[12px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto"
              />
            </span>
          </label>
          <div className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Categoría</span>
            <Select
              aria-label="Filtrar productos por categoría"
              variant="light"
              value={categoryId}
              options={[
                { value: 'all', label: 'Todas las categorías' },
                ...categorias.map((category) => ({ value: category.id, label: category.name })),
              ]}
              onValueChange={setCategoryId}
              className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !text-[12px] !font-normal !shadow-none"
              contentClassName="!rounded-[13px]"
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Estado</span>
            <Select
              aria-label="Filtrar productos por estado"
              variant="light"
              value={activeStatus}
              options={[
                { value: 'all', label: 'Todos los estados' },
                { value: 'active', label: 'Activos' },
                { value: 'inactive', label: 'Inactivos' },
              ]}
              onValueChange={(value) => setActiveStatus(value as 'all' | 'active' | 'inactive')}
              className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !text-[12px] !font-normal !shadow-none"
              contentClassName="!rounded-[13px]"
            />
          </div>
        </div>
      </section>

      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 px-0.5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-.035em] text-neutral-950">Listado de productos</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {isLoading ? 'Actualizando datos…' : `${productos.length.toLocaleString('es-AR')} ${productos.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
        </div>
        {!isLoading && hasFilters ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-central-orange/10 px-3 py-1.5 text-[11px] font-medium text-central-ember">
            <XCircle size={12} strokeWidth={1.7} /> Filtros activos
          </span>
        ) : null}
      </div>

      {productsError || categoriesError || ingredientsError ? (
        <DataLoadError
          message={productsError ?? categoriesError ?? ingredientsError ?? 'No se pudieron cargar los datos.'}
          onRetry={async () => {
            await Promise.all([refresh(), refreshCategories(), refreshIngredients()]);
          }}
        />
      ) : isLoading ? <ProductoTableSkeleton /> : <ProductoTable
        products={productos}
        categories={categorias}
        ingredients={ingredientes}
        onEdit={(product) => { setEditing(product); setModalOpen(true); }}
        onDelete={(id) => requestAction({ title: 'Eliminar producto', description: '¿Seguro que querés eliminar este producto? Esta acción quita el producto del catálogo.', confirmLabel: 'Eliminar', tone: 'danger', run: () => mutations.remove(id) })}
        onToggleActive={(id) => requestAction({ title: 'Cambiar estado del producto', description: '¿Seguro que querés activar o desactivar este producto?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleActive(id) })}
        onToggleAvailable={(id) => requestAction({ title: 'Cambiar disponibilidad', description: '¿Seguro que querés cambiar la disponibilidad de este producto en el menú?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleAvailable(id) })}
        onToggleFeatured={(id) => requestAction({ title: 'Cambiar destacado', description: '¿Seguro que querés modificar si este producto aparece como recomendado?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleFeatured(id) })}
      />}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        size="xl"
        theme="light"
        panelClassName="product-create-modal !max-w-[1480px] !rounded-[18px] !border-neutral-200/70 !bg-white"
      >
        <ProductoForm
          key={editing?.id ?? 'new'}
          product={editing}
          categories={categorias}
          ingredients={ingredientes}
          isSaving={mutations.isSaving}
          onCancel={() => setModalOpen(false)}
          onSubmit={(values) => setPendingFormValues(values)}
        />
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
        title={editing ? 'Guardar cambios del producto' : 'Crear producto'}
        description={editing ? '¿Seguro que querés guardar los cambios de este producto?' : '¿Seguro que querés crear este producto en el catálogo?'}
        confirmLabel={editing ? 'Guardar cambios' : 'Crear producto'}
        theme="light"
        isLoading={mutations.isSaving}
        onCancel={() => setPendingFormValues(null)}
        onConfirm={confirmFormSave}
      />
    </div>
  );
}
