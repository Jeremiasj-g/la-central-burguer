'use client';

import { useMemo, useState } from 'react';
import { Bike, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/ui/Modal';
import { Select } from '@/shared/components/ui/Select';
import { saveAccessUser } from '../services/access.service';
import type {
  AccessRole,
  AccessUser,
  AccessUserFormPayload,
  AccessVehicleType,
} from '../types/access.types';

interface AccessUserModalProps {
  user?: AccessUser;
  roles: AccessRole[];
  onClose: () => void;
  onSaved: () => void;
  defaultRoleCode?: string;
}

const fieldClass = 'h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm text-central-carbon outline-none transition focus:border-central-orange focus:ring-2 focus:ring-central-orange/15';
const textareaClass = 'min-h-24 w-full resize-y rounded-sm border border-neutral-200 bg-white px-3 py-2.5 text-sm text-central-carbon outline-none transition focus:border-central-orange focus:ring-2 focus:ring-central-orange/15';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500';
const vehicleOptions = [
  { value: 'moto', label: 'Moto' },
  { value: 'auto', label: 'Auto' },
  { value: 'bici', label: 'Bicicleta' },
  { value: 'otro', label: 'Otro' },
] as const;

export function AccessUserModal({ user, roles, onClose, onSaved, defaultRoleCode }: AccessUserModalProps) {
  const initialRoleIds = user?.roles.map((role) => role.id)
    ?? roles.filter((role) => role.code === defaultRoleCode).map((role) => role.id);

  const [form, setForm] = useState<AccessUserFormPayload>({
    userId: user?.id,
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    password: '',
    phone: user?.phone ?? '',
    notes: user?.notes ?? '',
    roleIds: initialRoleIds,
    vehicleType: user?.delivery?.vehicleType ?? 'moto',
    commissionPercent: user?.delivery?.commissionPercent ?? 30,
  });
  const [saving, setSaving] = useState(false);

  const deliveryRole = useMemo(() => roles.find((role) => role.code === 'delivery'), [roles]);
  const hasDeliveryRole = Boolean(deliveryRole && form.roleIds.includes(deliveryRole.id));

  function toggleRole(role: AccessRole) {
    if (!role.active && !form.roleIds.includes(role.id)) return;
    setForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(role.id)
        ? current.roleIds.filter((id) => id !== role.id)
        : [...current.roleIds, role.id],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.roleIds.length === 0) return toast.warning('Seleccioná al menos un rol.');
    if (!user && (!form.password || form.password.length < 8)) return toast.warning('La contraseña inicial debe tener al menos 8 caracteres.');
    if (hasDeliveryRole && (form.commissionPercent == null || form.commissionPercent < 0 || form.commissionPercent > 100)) {
      return toast.warning('La comisión del repartidor debe estar entre 0% y 100%.');
    }

    setSaving(true);
    try {
      await saveAccessUser(form);
      toast.success(user ? 'Usuario actualizado.' : 'Usuario creado correctamente.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={user ? 'Editar usuario' : 'Nuevo usuario'} size="lg" theme="light">
      <form onSubmit={submit}>
        <div className="mb-5 grid gap-3 rounded-sm border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-[auto_1fr]">
          <span className="grid h-10 w-10 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><ShieldCheck size={18} /></span>
          <div><p className="text-sm font-black text-central-carbon">Cuenta y autorización separadas</p><p className="mt-1 text-xs leading-5 text-neutral-500">La identidad pertenece al usuario; los permisos se heredan de uno o más roles. Así un mismo usuario puede evolucionar sin duplicar información.</p></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={labelClass}>Nombre y apellido</span><input className={fieldClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
          <label><span className={labelClass}>Email de acceso</span><input type="email" className={fieldClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label><span className={labelClass}>Teléfono</span><input className={fieldClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Opcional" /></label>
          {!user ? <label className="sm:col-span-2"><span className={labelClass}>Contraseña inicial</span><input type="password" minLength={8} className={fieldClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label> : null}
          <label className="sm:col-span-2"><span className={labelClass}>Notas internas</span><textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Observaciones administrativas opcionales" /></label>
        </div>

        <div className="mt-6">
          <div className="mb-3"><p className={labelClass}>Roles asignados</p><p className="text-xs text-neutral-500">Podés asignar más de un rol. Los permisos efectivos son la combinación de todos los roles activos.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => {
              const selected = form.roleIds.includes(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role)}
                  disabled={!role.active && !selected}
                  className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-sm border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-central-orange bg-central-orange/[.06]' : 'border-neutral-200 bg-white hover:border-central-orange/40'}`}
                >
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? 'border-central-orange bg-central-orange text-white' : 'border-neutral-300 bg-white'}`}>{selected ? <Check size={13} /> : null}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-black text-central-carbon">{role.name}</span><span className="mt-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-400">{role.code}</span></span>
                </button>
              );
            })}
          </div>
        </div>

        {hasDeliveryRole ? (
          <div className="mt-6 rounded-sm border border-central-orange/20 bg-[#fffaf2] p-4">
            <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><Bike size={17} /></span><div><p className="text-sm font-black text-central-carbon">Configuración de repartidor</p><p className="text-xs text-neutral-500">Estos datos sólo aplican mientras el usuario tenga el rol Delivery.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><span className={labelClass}>Vehículo</span><Select variant="light" value={form.vehicleType ?? 'moto'} options={vehicleOptions} onValueChange={(value) => setForm({ ...form, vehicleType: value as AccessVehicleType })} aria-label="Vehículo del repartidor" /></div>
              <label><span className={labelClass}>Comisión sobre el envío (%)</span><input type="number" min="0" max="100" step="0.01" className={fieldClass} value={form.commissionPercent ?? 0} onChange={(event) => setForm({ ...form, commissionPercent: Number(event.target.value) })} required /></label>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : user ? 'Guardar cambios' : 'Crear usuario'}</Button>
        </div>
      </form>
    </Modal>
  );
}
