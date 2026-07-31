'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Category } from '../types/categoria.types';
import { CategoriaForm } from '../components/CategoriaForm';
import { CategoriaTable } from '../components/CategoriaTable';
import { CategoriaTableSkeleton } from '../components/CategoriaTableSkeleton';
import { useCategoriaMutations } from '../hooks/useCategoriaMutations';
import { useCategorias } from '../hooks/useCategorias';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
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

  return (
    <div>
      <AdminPageHeader eyebrow="Categorías" title="Gestión de categorías" description="Ordená y activá las secciones del menú público." actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus size={18} /> Nueva categoría</Button>} />
      {error ? <DataLoadError message={error} onRetry={refresh} /> : isLoading ? <CategoriaTableSkeleton /> : <CategoriaTable
        categories={categorias}
        onEdit={(cat) => { setEditing(cat); setOpen(true); }}
        onDelete={(id) => setPendingAction({ title: 'Eliminar categoría', description: '¿Seguro que querés eliminar esta categoría? Esto quita la categoría del menú.', confirmLabel: 'Eliminar', tone: 'danger', run: () => mutations.remove(id) })}
        onToggleActive={(id) => setPendingAction({ title: 'Cambiar estado de categoría', description: '¿Seguro que querés activar o desactivar esta categoría?', confirmLabel: 'Confirmar cambio', run: () => mutations.toggleActive(id) })}
      />}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'} theme="dark">
        <CategoriaForm category={editing} isSaving={mutations.isSaving} onCancel={() => setOpen(false)} onSubmit={(values) => setPendingFormValues(values)} />
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
        title={editing ? 'Guardar cambios de categoría' : 'Crear categoría'}
        description={editing ? '¿Seguro que querés guardar los cambios de esta categoría?' : '¿Seguro que querés crear esta categoría?'}
        confirmLabel={editing ? 'Guardar cambios' : 'Crear categoría'}
        isLoading={mutations.isSaving}
        onCancel={() => setPendingFormValues(null)}
        onConfirm={confirmFormSave}
      />
    </div>
  );
}
