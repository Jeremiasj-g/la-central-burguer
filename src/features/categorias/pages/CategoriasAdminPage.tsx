'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Layers, Plus, RefreshCw, XCircle } from 'lucide-react';
import type { Category } from '../types/categoria.types';
import { CategoriaForm } from '../components/CategoriaForm';
import { CategoriaTable } from '../components/CategoriaTable';
import { CategoriaTableSkeleton } from '../components/CategoriaTableSkeleton';
import { useCategoriaMutations } from '../hooks/useCategoriaMutations';
import { useCategorias } from '../hooks/useCategorias';
import { useProductos } from '@/features/productos/hooks/useProductos';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Modal } from '@/shared/components/ui/Modal';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

type CategoryFormValues = { name: string; description?: string; order: number; active: boolean };
type PendingAction = { title: string; description: string; confirmLabel: string; tone?: 'default' | 'danger'; run: () => Promise<unknown> | unknown };

export function CategoriasAdminPage() {
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<CategoryFormValues | null>(null);
  const { categorias, isLoading, error, refresh } = useCategorias({ active: 'all' });
  const mutations = useCategoriaMutations(refresh);
  const { productos, isLoading: productsLoading, error: productsError } = useProductos({ active: 'all', available: 'all' });

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
    setOpen(false);
  }

  const activeCount = categorias.filter((category) => category.active).length;
  const inactiveCount = categorias.length - activeCount;
  const categoriesWithProducts = new Set(productos.map((product) => product.categoryId));
  const emptyCount = categorias.filter((category) => !categoriesWithProducts.has(category.id)).length;

  return (
    <div className="catalog-wallet min-w-0 pb-8">
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Gestión de categorías</h1>
          <p className="mt-1 text-[13px] leading-5 text-neutral-500">Organizá y administrá las secciones de tu menú público.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            title="Actualizar categorías"
            aria-label="Actualizar categorías"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border border-neutral-200 bg-white text-neutral-600 transition duration-200 hover:bg-neutral-50 hover:text-neutral-900 active:scale-[.97] disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Button
            size="sm"
            className="!h-9 !rounded-[11px] !bg-[#191b20] !px-3 !text-[12px] !font-medium !shadow-none transition duration-200 hover:!bg-neutral-700 active:scale-[.98]"
            onClick={() => { setEditing(null); setOpen(true); }}
          >
            <Plus size={16} strokeWidth={1.9} /> Nueva categoría
          </Button>
        </div>
      </div>

      <section aria-label="Resumen de categorías" className="relative mb-5 flex min-w-0 flex-col overflow-hidden rounded-[23px] bg-[#191b20] p-5 text-white shadow-soft sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <span className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-central-orange/10 blur-[60px]" aria-hidden="true" />
        <div className="relative min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-white/10 bg-white/[.08]"><Layers size={18} strokeWidth={1.7} className="text-white/80" /></span>
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/45">Tu catálogo</span>
          </div>
          <p className="mt-5 text-[12px] text-white/60">Categorías registradas</p>
          <p className="mt-1 text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-[-.055em] tabular-nums">{isLoading ? '—' : categorias.length.toLocaleString('es-AR')}</p>
          <p className="mt-2 text-[11px] text-white/40">Organizá cómo se presenta el menú.</p>
        </div>
        <div className="relative mt-6 grid min-w-0 grid-cols-3 gap-3 border-t border-white/10 pt-5 sm:max-w-[570px] lg:mt-0 lg:w-[52%] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <div className="flex items-center gap-1.5 text-white/55"><CheckCircle2 size={14} strokeWidth={1.8} className="text-emerald-300" /><span className="text-[11px]">Activas</span></div>
            <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-.045em] tabular-nums text-[#c7f0d7]">{isLoading ? '—' : activeCount}</p>
          </div>
          <div className="border-l border-white/10 pl-4">
            <div className="flex items-center gap-1.5 text-white/55"><XCircle size={14} strokeWidth={1.8} className="text-white/60" /><span className="text-[11px]">Inactivas</span></div>
            <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-.045em] tabular-nums text-white/80">{isLoading ? '—' : inactiveCount}</p>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-3 sm:pl-4">
            <div className="flex items-center gap-1.5 text-white/55"><span className="text-[13px] text-amber-300">!</span><span className="text-[11px]">Vacías</span></div>
            <p className="mt-2 text-[25px] font-semibold leading-none tabular-nums text-amber-200">{isLoading || productsLoading || productsError ? '—' : emptyCount}</p>
          </div>
        </div>
      </section>

      <div className="mb-3 flex min-w-0 items-center justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-.035em] text-neutral-950">Listado de categorías</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">Editá los datos, el orden y la disponibilidad de cada categoría.</p>
        </div>
      </div>

      {error
        ? <DataLoadError message={error} onRetry={refresh} />
        : isLoading
          ? <CategoriaTableSkeleton />
          : <CategoriaTable
              categories={categorias}
              onEdit={(cat) => { setEditing(cat); setOpen(true); }}
              onDelete={(id) => setPendingAction({ title: 'Eliminar categoría', description: '¿Seguro que querés eliminar esta categoría? Esto quita la categoría del menú.', confirmLabel: 'Eliminar', tone: 'danger', run: () => mutations.remove(id) })}
              onToggleActive={(id) => setPendingAction({ title: 'Cambiar estado de categoría', description: '¿Seguro que querés activar o desactivar esta categoría?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleActive(id) })}
            />}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'} theme="light" panelClassName="!rounded-[20px] !border-neutral-200/80 !bg-white">
        <CategoriaForm key={editing?.id ?? 'new'} category={editing} isSaving={mutations.isSaving} onCancel={() => setOpen(false)} onSubmit={(values) => setPendingFormValues(values)} />
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
        title={editing ? 'Guardar cambios de categoría' : 'Crear categoría'}
        description={editing ? '¿Seguro que querés guardar los cambios de esta categoría?' : '¿Seguro que querés crear esta categoría?'}
        confirmLabel={editing ? 'Guardar cambios' : 'Crear categoría'}
        theme="light"
        isLoading={mutations.isSaving}
        onCancel={() => setPendingFormValues(null)}
        onConfirm={confirmFormSave}
      />
    </div>
  );
}
