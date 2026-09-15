'use client';

import { useMemo, useState } from 'react';
import { CircleDollarSign, Plus, Search } from 'lucide-react';
import type { Ingredient } from '../types/ingrediente.types';
import { IngredienteForm } from '../components/IngredienteForm';
import { IngredienteTable } from '../components/IngredienteTable';
import { IngredienteTableSkeleton } from '../components/IngredienteTableSkeleton';
import { useIngredienteMutations } from '../hooks/useIngredienteMutations';
import { useIngredientes } from '../hooks/useIngredientes';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Modal } from '@/shared/components/ui/Modal';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

const adminInputClass = '!bg-white !text-central-carbon !placeholder:text-neutral-500 border-neutral-200';

type IngredientFormValues = { name: string; type: Ingredient['type']; unit: Ingredient['unit']; unitCost: number; supplier?: string; active: boolean };
type PendingAction = { title: string; description: string; confirmLabel: string; tone?: 'default' | 'danger'; run: () => Promise<unknown> | unknown };

export function IngredientesAdminPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<IngredientFormValues | null>(null);
  const { ingredientes, isLoading, error, refresh } = useIngredientes({ search, active: 'all' });
  const mutations = useIngredienteMutations(refresh);

  const pricedCount = useMemo(() => ingredientes.filter((item) => item.unitCost > 0).length, [ingredientes]);
  const pendingPriceCount = ingredientes.length - pricedCount;

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

  return (
    <div>
      <AdminPageHeader
        eyebrow="Ingredientes"
        title="Ingredientes y costos base"
        description="Definí el costo por unidad de cada ingrediente. Estos valores alimentan automáticamente el análisis de costo y rentabilidad de las recetas."
        actions={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={18} /> Nuevo ingrediente</Button>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_220px_220px]">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <Input className={`pl-11 ${adminInputClass}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ingrediente" />
        </label>
        <div className="flex items-center gap-3 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CircleDollarSign size={19} className="text-emerald-600" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-600">Con costo</p>
            <p className="text-lg font-black text-central-carbon">{pricedCount}</p>
          </div>
        </div>
        <div className="rounded-sm border border-neutral-200 bg-white px-4 py-3 shadow-soft">
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">Pendientes de costo</p>
          <p className="mt-1 text-lg font-black text-central-carbon">{pendingPriceCount}</p>
        </div>
      </div>

      {error ? <DataLoadError message={error} onRetry={refresh} /> : isLoading ? <IngredienteTableSkeleton /> : <IngredienteTable
        ingredients={ingredientes}
        onEdit={(ing) => { setEditing(ing); setModalOpen(true); }}
        onDelete={(id) => setPendingAction({ title: 'Eliminar ingrediente', description: '¿Seguro que querés eliminar este ingrediente? Ya no aparecerá como opción disponible para nuevas recetas.', confirmLabel: 'Eliminar', tone: 'danger', run: () => mutations.remove(id) })}
        onToggleActive={(id) => setPendingAction({ title: 'Cambiar estado de ingrediente', description: '¿Seguro que querés activar o desactivar este ingrediente?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleActive(id) })}
      />}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'} theme="dark">
        <IngredienteForm ingredient={editing} isSaving={mutations.isSaving} onCancel={() => setModalOpen(false)} onSubmit={(values) => setPendingFormValues(values)} />
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description ?? ''}
        confirmLabel={pendingAction?.confirmLabel}
        tone={pendingAction?.tone}
        isLoading={mutations.isSaving}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
      <ConfirmDialog
        open={Boolean(pendingFormValues)}
        title={editing ? 'Guardar cambios de ingrediente' : 'Crear ingrediente'}
        description={editing ? '¿Seguro que querés guardar los cambios? El nuevo costo impactará inmediatamente en la rentabilidad calculada de las recetas que usen este ingrediente.' : '¿Seguro que querés crear este ingrediente con este costo base?'}
        confirmLabel={editing ? 'Guardar cambios' : 'Crear ingrediente'}
        isLoading={mutations.isSaving}
        onCancel={() => setPendingFormValues(null)}
        onConfirm={confirmFormSave}
      />
    </div>
  );
}
