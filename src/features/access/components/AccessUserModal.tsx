'use client';

import { useMemo, useState } from 'react';
import { Bike, Check, KeyRound, MailCheck, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/ui/Modal';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
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
    phone: user?.phone ?? '',
    notes: user?.notes ?? '',
    roleIds: initialRoleIds,
    vehicleType: user?.delivery?.vehicleType ?? 'moto',
    commissionPercent: user?.delivery?.commissionPercent ?? 30,
    sendInvitation: user ? undefined : true,
    password: '',
  });
  const [saving, setSaving] = useState(false);

  const deliveryRole = useMemo(() => roles.find((role) => role.code === 'delivery'), [roles]);
  const hasDeliveryRole = Boolean(deliveryRole && form.roleIds.includes(deliveryRole.id));
  const sendInvitation = !user && form.sendInvitation !== false;

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
    if (!user && !sendInvitation && (!form.password || form.password.length < 8)) {
      return toast.warning('Definí una contraseña inicial de al menos 8 caracteres.');
    }
    if (hasDeliveryRole && (form.commissionPercent == null || form.commissionPercent < 0 || form.commissionPercent > 100)) {
      return toast.warning('La comisión del repartidor debe estar entre 0% y 100%.');
    }

    setSaving(true);
    try {
      await saveAccessUser(form);
      toast.success(
        user
          ? 'Usuario actualizado.'
          : sendInvitation
            ? 'Invitación enviada. El usuario deberá verificar su email y crear su contraseña.'
            : 'Usuario creado y habilitado. Puede iniciar sesión inmediatamente con la contraseña definida.',
      );
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

        {!user ? (
          <div className={`mb-5 rounded-sm border p-4 transition-colors ${sendInvitation ? 'border-blue-100 bg-blue-50' : 'border-orange-200 bg-[#fffaf2]'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-white ${sendInvitation ? 'text-blue-600' : 'text-central-orange'}`}>
                  {sendInvitation ? <MailCheck size={18} /> : <UserPlus size={18} />}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-black ${sendInvitation ? 'text-blue-950' : 'text-central-carbon'}`}>
                    {sendInvitation ? 'Enviar invitación por correo' : 'Crear cuenta directamente'}
                  </p>
                  <p className={`mt-1 text-xs leading-5 ${sendInvitation ? 'text-blue-700' : 'text-neutral-600'}`}>
                    {sendInvitation
                      ? 'La Central enviará un correo para verificar el email. Desde ese enlace el usuario creará su propia contraseña y activará la cuenta.'
                      : 'No se enviará ningún correo. El email quedará confirmado y la cuenta activa desde el alta; definí abajo una contraseña inicial para que pueda ingresar.'}
                  </p>
                </div>
              </div>

              <label className="inline-flex shrink-0 cursor-pointer items-center pt-1" title={sendInvitation ? 'Desactivar invitación por correo' : 'Activar invitación por correo'}>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={sendInvitation}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    sendInvitation: event.target.checked,
                    password: event.target.checked ? '' : current.password,
                  }))}
                />
                <span className="relative h-6 w-11 rounded-full bg-neutral-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-central-orange peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-central-orange/30" />
                <span className="sr-only">Enviar invitación por correo</span>
              </label>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={labelClass}>Nombre y apellido</span><input className={fieldClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
          <label><span className={labelClass}>Email de acceso</span><input type="email" className={fieldClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label><span className={labelClass}>Teléfono</span><input className={fieldClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Opcional" /></label>
          {!user && !sendInvitation ? (
            <label className="sm:col-span-2">
              <span className={labelClass}>Contraseña inicial</span>
              <PasswordInput
                variant="light"
                minLength={8}
                value={form.password ?? ''}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
              />
              <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-neutral-500"><KeyRound size={12} /> El usuario podrá cambiarla después desde el flujo de administración.</span>
            </label>
          ) : null}
          <label className="sm:col-span-2"><span className={labelClass}>Notas internas</span><textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Observaciones administrativas opcionales" /></label>
        </div>

        <div className="mt-6">
          <div className="mb-3"><p className={labelClass}>Roles asignados</p><p className="text-xs text-neutral-500">Podés asignar más de un rol. Los permisos efectivos son la combinación de todos los roles activos.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => {
              const selected = form.roleIds.includes(role.id);
              return (
                <button key={role.id} type="button" onClick={() => toggleRole(role)} disabled={!role.active && !selected} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-sm border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-central-orange bg-central-orange/[.06]' : 'border-neutral-200 bg-white hover:border-central-orange/40'}`}>
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
          <Button type="submit" disabled={saving}>{saving ? (user ? 'Guardando…' : sendInvitation ? 'Enviando…' : 'Creando…') : user ? 'Guardar cambios' : sendInvitation ? 'Enviar invitación' : 'Crear usuario'}</Button>
        </div>
      </form>
    </Modal>
  );
}
