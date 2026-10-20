'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Package, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
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
import { Modal } from '@/shared/components/ui/Modal';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

type IngredientFormValues = { name: string; type: Ingredient['type']; unit: Ingredient['unit']; unitCost: number; supplier?: string; active: boolean };
type PendingAction = { title: string; description: string; confirmLabel: string; tone?: 'default' | 'danger'; run: () => Promise<unknown> | unknown };

export function IngredientesAdminPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [historyIngredient, setHistoryIngredient] = useState<Ingredient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<IngredientFormValues | null>(null);
  const { ingredientes, isLoading, error, refresh } = useIngredientes({ search, active: 'all' });
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

  const activeCount = ingredientes.filter((ingredient) => ingredient.active).length;
  const inactiveCount = ingredientes.length - activeCount;

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
          <p className="mt-5 text-[12px] text-white/60">Ingredientes en la vista actual</p>
          <p className="mt-1 text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-[-.055em] tabular-nums">{isLoading ? '—' : ingredientes.length.toLocaleString('es-AR')}</p>
          <p className="mt-2 text-[11px] text-white/40">El resumen refleja la búsqueda actual.</p>
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

      <section aria-label="Buscar ingredientes" className="mb-6 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-3">
          <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Encontrá un ingrediente</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">Buscá rápidamente por nombre.</p>
        </div>
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} strokeWidth={1.8} />
          <Input className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !pl-10 !pr-3 !text-[12px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ingrediente" aria-label="Buscar ingrediente" />
        </label>
      </section>

      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 px-0.5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-.035em] text-neutral-950">Listado de ingredientes</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">{isLoading ? 'Actualizando datos…' : `${ingredientes.length.toLocaleString('es-AR')} ${ingredientes.length === 1 ? 'resultado' : 'resultados'}`}</p>
        </div>
        {Boolean(search.trim()) && !isLoading ? <span className="rounded-full bg-central-orange/10 px-3 py-1.5 text-[11px] font-medium text-central-ember">Búsqueda activa</span> : null}
      </div>

      {error
        ? <DataLoadError message={error} onRetry={refresh} />
        : isLoading
          ? <IngredienteTableSkeleton />
          : <IngredienteTable
              ingredients={ingredientes}
              onEdit={(ing) => { setEditing(ing); setModalOpen(true); }}
              onHistory={setHistoryIngredient}
              onDelete={(id) => setPendingAction({ title: 'Eliminar ingrediente', description: '¿Seguro que querés eliminar este ingrediente? Ya no aparecerá como chip disponible para nuevos productos.', confirmLabel: 'Eliminar', tone: 'danger', run: () => mutations.remove(id) })}
              onToggleActive={(id) => setPendingAction({ title: 'Cambiar estado de ingrediente', description: '¿Seguro que querés activar o desactivar este ingrediente?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleActive(id) })}
            />}

      <IngredientCostHistoryModal ingredient={historyIngredient} onClose={() => setHistoryIngredient(null)} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'} theme="light" panelClassName="!rounded-[20px] !border-neutral-200/80 !bg-white">
        <IngredienteForm key={editing?.id ?? 'new'} ingredient={editing} isSaving={mutations.isSaving} onCancel={() => setModalOpen(false)} onSubmit={(values) => setPendingFormValues(values)} />
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
