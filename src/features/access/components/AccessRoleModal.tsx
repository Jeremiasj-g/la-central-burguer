'use client';

import { useMemo, useState } from 'react';
import { Check, KeyRound, LockKeyhole } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/ui/Modal';
import { saveAccessRole } from '../services/access.service';
import type { AccessPermission, AccessRole, AccessRoleFormPayload } from '../types/access.types';

interface AccessRoleModalProps {
  role?: AccessRole;
  permissions: AccessPermission[];
  onClose: () => void;
  onSaved: () => void;
}

const fieldClass = 'h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm text-central-carbon outline-none transition focus:border-central-orange focus:ring-2 focus:ring-central-orange/15 disabled:bg-neutral-100 disabled:text-neutral-500';
const textareaClass = 'min-h-24 w-full resize-y rounded-sm border border-neutral-200 bg-white px-3 py-2.5 text-sm text-central-carbon outline-none transition focus:border-central-orange focus:ring-2 focus:ring-central-orange/15';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500';

export function AccessRoleModal({ role, permissions, onClose, onSaved }: AccessRoleModalProps) {
  const [form, setForm] = useState<AccessRoleFormPayload>({
    roleId: role?.id,
    code: role?.code ?? '',
    name: role?.name ?? '',
    description: role?.description ?? '',
    active: role?.active ?? true,
    permissionCodes: role?.permissionCodes ?? [],
  });
  const [saving, setSaving] = useState(false);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AccessPermission[]>();
    permissions.forEach((permission) => {
      const current = groups.get(permission.module) ?? [];
      current.push(permission);
      groups.set(permission.module, current);
    });
    return [...groups.entries()];
  }, [permissions]);

  function togglePermission(code: string) {
    setForm((current) => ({
      ...current,
      permissionCodes: current.permissionCodes.includes(code)
        ? current.permissionCodes.filter((item) => item !== code)
        : [...current.permissionCodes, code],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveAccessRole({ ...form, code: form.code.trim().toLowerCase() });
      toast.success(role ? 'Rol actualizado.' : 'Rol creado correctamente.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el rol.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={role ? 'Editar rol' : 'Nuevo rol'} size="lg" theme="light">
      <form onSubmit={submit}>
        <div className="mb-5 flex gap-3 rounded-sm border border-neutral-200 bg-neutral-50 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><KeyRound size={18} /></span>
          <div><p className="text-sm font-black text-central-carbon">Permisos reutilizables</p><p className="mt-1 text-xs leading-5 text-neutral-500">Los roles agrupan permisos. Los usuarios sólo se vinculan a roles, evitando repetir reglas de acceso por persona.</p></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Nombre del rol</span><input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label><span className={labelClass}>Código interno</span><input className={fieldClass} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase().replace(/\s+/g, '-') })} required disabled={Boolean(role?.isSystem)} placeholder="ej. cocina" /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Descripción</span><textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Qué responsabilidad representa este rol" /></label>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className={labelClass}>Permisos</p><p className="text-xs text-neutral-500">Seleccioná las capacidades que heredarán los usuarios con este rol.</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-600">{form.permissionCodes.length} seleccionados</span></div>
          <div className="space-y-4">
            {groupedPermissions.map(([module, modulePermissions]) => (
              <section key={module} className="rounded-sm border border-neutral-200 p-4">
                <div className="mb-3 flex items-center gap-2"><LockKeyhole size={15} className="text-central-orange" /><h3 className="text-sm font-black text-central-carbon">{module}</h3></div>
                <div className="grid gap-2 md:grid-cols-2">
                  {modulePermissions.map((permission) => {
                    const selected = form.permissionCodes.includes(permission.code);
                    return (
                      <button key={permission.id} type="button" onClick={() => togglePermission(permission.code)} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-left transition ${selected ? 'border-central-orange bg-central-orange/[.05]' : 'border-neutral-200 hover:border-central-orange/35'}`}>
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? 'border-central-orange bg-central-orange text-white' : 'border-neutral-300 bg-white'}`}>{selected ? <Check size={13} /> : null}</span>
                        <span className="min-w-0"><span className="block text-sm font-bold text-central-carbon">{permission.name}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{permission.description || permission.code}</span></span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-sm border border-neutral-200 bg-neutral-50 p-3">
          <div><p className="text-sm font-black text-central-carbon">Rol activo</p><p className="text-xs text-neutral-500">Los roles inactivos no otorgan permisos ni pueden asignarse a nuevos usuarios.</p></div>
          <button type="button" disabled={Boolean(role?.isSystem)} onClick={() => setForm({ ...form, active: !form.active })} className={`relative h-7 w-12 cursor-pointer rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${form.active ? 'bg-emerald-500' : 'bg-neutral-300'}`} aria-label="Alternar rol activo"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${form.active ? 'left-6' : 'left-1'}`} /></button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : role ? 'Guardar cambios' : 'Crear rol'}</Button>
        </div>
      </form>
    </Modal>
  );
}
