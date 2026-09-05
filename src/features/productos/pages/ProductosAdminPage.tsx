'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { Product } from '../types/producto.types';
import { ProductoForm } from '../components/ProductoForm';
import { ProductoTable } from '../components/ProductoTable';
import { ProductoTableSkeleton } from '../components/ProductoTableSkeleton';
import { useProductoMutations } from '../hooks/useProductoMutations';
import { useProductos } from '../hooks/useProductos';
import { useCategorias } from '@/features/categorias/hooks/useCategorias';
import { useIngredientes } from '@/features/ingredientes/hooks/useIngredientes';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Modal } from '@/shared/components/ui/Modal';
import { Select } from '@/shared/components/ui/Select';
import { DataLoadError } from '@/shared/components/feedback/DataLoadError';

const adminInputClass = '!bg-white !text-central-carbon !placeholder:text-neutral-500 border-neutral-200';

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
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<ProductFormValues | null>(null);
  const { categorias, error: categoriesError, refresh: refreshCategories } = useCategorias({ active: 'all' });
  const { ingredientes, error: ingredientsError, refresh: refreshIngredients } = useIngredientes({ active: 'active' });
  const { productos, isLoading, error: productsError, refresh } = useProductos({ search, categoryId, active: 'all', available: 'all' });
  const mutations = useProductoMutations(refresh);

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

  return (
    <div>
      <AdminPageHeader
        eyebrow="Productos"
        title="Gestión de productos"
        description="Alta, edición y disponibilidad de productos. El precio de venta se carga manualmente."
        actions={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={18} /> Nuevo producto</Button>}
      />
      <div className="mb-6 grid gap-3 rounded-sm border border-neutral-200 bg-white p-4 shadow-soft md:grid-cols-[1fr_260px]">
        <label className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <Input className={`pl-11 ${adminInputClass}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto" />
        </label>
        <Select
          aria-label="Filtrar productos por categoría"
          variant="light"
          value={categoryId}
          options={[
            { value: 'all', label: 'Todas las categorías' },
            ...categorias.map((category) => ({ value: category.id, label: category.name })),
          ]}
          onValueChange={setCategoryId}
        />
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto' : 'Añadir Producto'} size="xl" theme="dark">
        <ProductoForm
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
        isLoading={mutations.isSaving}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
      <ConfirmDialog
        open={Boolean(pendingFormValues)}
        title={editing ? 'Guardar cambios del producto' : 'Crear producto'}
        description={editing ? '¿Seguro que querés guardar los cambios de este producto?' : '¿Seguro que querés crear este producto en el catálogo?'}
        confirmLabel={editing ? 'Guardar cambios' : 'Crear producto'}
        isLoading={mutations.isSaving}
        onCancel={() => setPendingFormValues(null)}
        onConfirm={confirmFormSave}
      />
    </div>
  );
}
