'use client';

import { useState } from 'react';
import type { Category } from '../types/categoria.types';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Textarea } from '@/shared/components/ui/Textarea';

export function CategoriaForm({ category, isSaving, onSubmit, onCancel }: { category?: Category | null; isSaving?: boolean; onSubmit: (values: { name: string; description?: string; order: number; active: boolean }) => void; onCancel: () => void }) {
  const [values, setValues] = useState({ name: category?.name ?? '', description: category?.description ?? '', order: category?.order ?? 1, active: category?.active ?? true });
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
      <div className="admin-modal-field">
        <label className="admin-modal-label">Nombre</label>
        <Input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required />
      </div>
      <div className="admin-modal-field">
        <label className="admin-modal-label">Descripción</label>
        <Textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
      </div>
      <div className="admin-modal-field">
        <label className="admin-modal-label">Orden</label>
        <Input type="number" value={values.order} onChange={(event) => setValues({ ...values, order: Number(event.target.value) })} />
      </div>
      <div className="admin-modal-field">
        <span className="admin-modal-label">Estado</span>
        <label className="flex items-center gap-3 rounded-sm border border-white/10 bg-white/[.04] p-3 text-sm font-bold text-white/85">
          <input type="checkbox" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} /> Activa
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
        <Button type="button" variant="dark" className="rounded-sm bg-white/10 hover:bg-white/15" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="rounded-sm" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar categoría'}</Button>
      </div>
    </form>
  );
}
