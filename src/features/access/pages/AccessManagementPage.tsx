'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bike,
  Edit3,
  KeyRound,
  LayoutGrid,
  List,
  MailCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Modal } from '@/shared/components/ui/Modal';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
import { formatDateTime } from '@/shared/utils/format.utils';
import { AccessManagementSkeleton } from '../components/AccessManagementSkeleton';
import { AccessRoleModal } from '../components/AccessRoleModal';
import { AccessUserModal } from '../components/AccessUserModal';
import {
  archiveAccessUser,
  deleteAccessRole,
  getAccessManagementDashboard,
  resetAccessUserPassword,
  restoreAccessUser,
  setAccessUserActive,
} from '../services/access.service';
import type { AccessManagementDashboard, AccessRole, AccessUser } from '../types/access.types';

type Tab = 'users' | 'roles';
type UserViewMode = 'grid' | 'table';
type ConfirmState =
  | { type: 'set-active'; user: AccessUser; active: boolean }
  | { type: 'archive'; user: AccessUser }
  | { type: 'restore'; user: AccessUser }
  | { type: 'delete-role'; role: AccessRole };

const EMPTY: AccessManagementDashboard = { users: [], roles: [], permissions: [] };
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500';

function Metric({ icon: Icon, label, value, helper }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; helper: string }) {
  return (
    <article className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-2 text-2xl font-black text-central-carbon">{value}</p><p className="mt-1 text-xs leading-5 text-neutral-500">{helper}</p></div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><Icon size={18} /></span>
      </div>
    </article>
  );
}

function StatusBadge({ user }: { user: AccessUser }) {
  if (user.accessStatus === 'archived') return <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-[10px] font-black uppercase text-neutral-600">Archivado</span>;
  if (user.accessStatus === 'pending_activation') return <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase text-orange-700">Pendiente de activación</span>;
  if (user.accessStatus === 'inactive') return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">Inactivo</span>;
  return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">Activo</span>;
}

function UserCard({ user, onEdit, onPassword, onConfirm }: {
  user: AccessUser;
  onEdit: () => void;
  onPassword: () => void;
  onConfirm: (state: ConfirmState) => void;
}) {
  const pending = user.accessStatus === 'pending_activation';
  const active = user.accessStatus === 'active';

  return (
    <article className={`min-w-0 rounded-sm border bg-white p-4 shadow-sm ${user.accessStatus === 'archived' ? 'border-neutral-200 opacity-70' : 'border-neutral-200'}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-central-carbon">{user.fullName}</h3><StatusBadge user={user} /></div>
          <p className="mt-1 truncate text-sm text-neutral-500">{user.email || 'Sin email'}</p>
          {user.phone ? <p className="mt-1 text-xs text-neutral-400">{user.phone}</p> : null}
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-sm ${pending ? 'bg-orange-50 text-orange-600' : 'bg-neutral-100 text-neutral-600'}`}>{pending ? <MailCheck size={16} /> : <Users size={16} />}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {user.roles.map((role) => <span key={role.id} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${role.code === 'admin' ? 'border-violet-200 bg-violet-50 text-violet-700' : role.code === 'delivery' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}>{role.name}</span>)}
        {user.roles.length === 0 ? <span className="text-xs text-red-500">Sin roles asignados</span> : null}
      </div>

      {pending ? (
        <div className="mt-4 rounded-sm border border-orange-100 bg-orange-50 p-3 text-xs leading-5 text-orange-800">
          <strong>Esperando verificación.</strong> El usuario todavía debe abrir el correo de invitación, verificar su email y crear su contraseña.
        </div>
      ) : null}

      {user.delivery ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-sm border border-central-orange/15 bg-[#fffaf2] p-3">
          <div className="flex items-center gap-2"><Bike size={15} className="text-central-orange" /><div><p className="text-xs font-black text-central-carbon">Repartidor · {user.delivery.vehicleType}</p><p className="mt-0.5 text-[11px] text-neutral-500">Comisión vigente {user.delivery.commissionPercent ?? 0}%</p></div></div>
          <span className={`h-2.5 w-2.5 rounded-full ${user.delivery.active ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-sm bg-neutral-50 p-3 text-xs">
        <div><p className="text-neutral-400">{pending ? 'Invitación enviada' : 'Creado'}</p><p className="mt-1 font-bold text-neutral-700">{pending && user.confirmationSentAt ? formatDateTime(user.confirmationSentAt) : formatDateTime(user.createdAt)}</p></div>
        <div><p className="text-neutral-400">{pending ? 'Email verificado' : 'Último ingreso'}</p><p className="mt-1 font-bold text-neutral-700">{pending ? 'Pendiente' : user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'Nunca'}</p></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit}><Edit3 size={14} /> Editar</Button>
        {!pending && user.accessStatus !== 'archived' ? <Button size="sm" variant="secondary" onClick={onPassword}><KeyRound size={14} /> Clave</Button> : null}
        {!pending && user.accessStatus !== 'archived' ? <Button size="sm" variant={active ? 'secondary' : 'dark'} onClick={() => onConfirm({ type: 'set-active', user, active: !active })}>{active ? <UserRoundX size={14} /> : <UserRoundCheck size={14} />}{active ? 'Desactivar' : 'Activar'}</Button> : null}
        {user.accessStatus !== 'archived' ? <Button size="sm" variant="danger" onClick={() => onConfirm({ type: 'archive', user })}><Archive size={14} /> Archivar</Button> : <Button size="sm" variant="dark" onClick={() => onConfirm({ type: 'restore', user })}><RotateCcw size={14} /> Restaurar</Button>}
      </div>
    </article>
  );
}

function TableActionButton({ label, tone = 'default', children, onClick }: {
  label: string;
  tone?: 'default' | 'danger' | 'dark';
  children: React.ReactNode;
  onClick: () => void;
}) {
  const toneClass = tone === 'danger'
    ? 'border-red-100 bg-red-50 text-red-600 hover:bg-red-100'
    : tone === 'dark'
      ? 'border-[#1C1C1E] bg-[#1C1C1E] text-white hover:bg-black'
      : 'border-[#E5E5EA] bg-white text-[#636366] hover:border-[#FF9500]/35 hover:text-[#C86E00]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border transition active:scale-95 ${toneClass}`}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function UserTableRow({ user, onEdit, onPassword, onConfirm }: {
  user: AccessUser;
  onEdit: () => void;
  onPassword: () => void;
  onConfirm: (state: ConfirmState) => void;
}) {
  const pending = user.accessStatus === 'pending_activation';
  const active = user.accessStatus === 'active';
  const createdLabel = pending ? 'Invitación enviada' : 'Creado';
  const createdValue = pending && user.confirmationSentAt ? formatDateTime(user.confirmationSentAt) : formatDateTime(user.createdAt);
  const lastLabel = pending ? 'Email verificado' : 'Último ingreso';
  const lastValue = pending ? 'Pendiente' : user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'Nunca';

  return (
    <div className={`grid min-w-0 grid-cols-1 gap-3 border-t border-[#E5E5EA] px-4 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,.8fr)_minmax(0,1.05fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1.35fr)] xl:items-center ${user.accessStatus === 'archived' ? 'opacity-65' : ''}`}>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="min-w-0 break-words text-[13px] font-semibold text-[#1C1C1E]">{user.fullName}</p>
          <StatusBadge user={user} />
        </div>
        <p className="mt-1 break-all text-[11px] leading-4 text-[#8E8E93]">{user.email || 'Sin email'}</p>
        {user.phone ? <p className="mt-0.5 text-[10px] text-[#AEAEB2]">{user.phone}</p> : null}
      </div>

      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[#AEAEB2] xl:hidden">Roles</p>
        <div className="flex min-w-0 flex-wrap gap-1">
          {user.roles.map((role) => (
            <span key={role.id} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${role.code === 'admin' ? 'border-violet-200 bg-violet-50 text-violet-700' : role.code === 'delivery' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}>{role.name}</span>
          ))}
          {user.roles.length === 0 ? <span className="text-[10px] text-red-500">Sin roles</span> : null}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[#AEAEB2] xl:hidden">Delivery</p>
        {user.delivery ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[#FFF3E0] text-[#FF9500]"><Bike size={13} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5"><p className="truncate text-[11px] font-semibold text-[#1C1C1E] capitalize">{user.delivery.vehicleType}</p><span className={`h-2 w-2 shrink-0 rounded-full ${user.delivery.active ? 'bg-emerald-500' : 'bg-neutral-300'}`} /></div>
              <p className="mt-0.5 text-[10px] text-[#8E8E93]">Comisión {user.delivery.commissionPercent ?? 0}%</p>
            </div>
          </div>
        ) : <span className="text-[11px] text-[#AEAEB2]">—</span>}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] text-[#AEAEB2]">{createdLabel}</p>
        <p className="mt-1 break-words text-[11px] font-medium leading-4 text-[#636366]">{createdValue}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] text-[#AEAEB2]">{lastLabel}</p>
        <p className="mt-1 break-words text-[11px] font-medium leading-4 text-[#636366]">{lastValue}</p>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#AEAEB2] xl:hidden">Acciones</p>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 xl:justify-end">
          <TableActionButton label="Editar" onClick={onEdit}><Edit3 size={14} /></TableActionButton>
          {!pending && user.accessStatus !== 'archived' ? <TableActionButton label="Cambiar clave" onClick={onPassword}><KeyRound size={14} /></TableActionButton> : null}
          {!pending && user.accessStatus !== 'archived' ? (
            <TableActionButton label={active ? 'Desactivar' : 'Activar'} tone={active ? 'default' : 'dark'} onClick={() => onConfirm({ type: 'set-active', user, active: !active })}>
              {active ? <UserRoundX size={14} /> : <UserRoundCheck size={14} />}
            </TableActionButton>
          ) : null}
          {user.accessStatus !== 'archived' ? (
            <TableActionButton label="Archivar" tone="danger" onClick={() => onConfirm({ type: 'archive', user })}><Archive size={14} /></TableActionButton>
          ) : (
            <TableActionButton label="Restaurar" tone="dark" onClick={() => onConfirm({ type: 'restore', user })}><RotateCcw size={14} /></TableActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleCard({ role, onEdit, onDelete }: { role: AccessRole; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className={`rounded-sm border bg-white p-4 shadow-sm ${role.active ? 'border-neutral-200' : 'border-neutral-200 opacity-65'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-central-carbon">{role.name}</h3>{role.isSystem ? <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black uppercase text-violet-700">Sistema</span> : null}{!role.active ? <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-black uppercase text-neutral-500">Inactivo</span> : null}</div><p className="mt-1 font-mono text-xs text-neutral-400">{role.code}</p></div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><Shield size={16} /></span>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-5 text-neutral-500">{role.description || 'Sin descripción.'}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-sm bg-neutral-50 p-3 text-center"><div><p className="text-[11px] text-neutral-400">Usuarios</p><p className="mt-1 text-lg font-black text-central-carbon">{role.usersCount}</p></div><div><p className="text-[11px] text-neutral-400">Permisos</p><p className="mt-1 text-lg font-black text-central-carbon">{role.permissionCodes.length}</p></div></div>
      <div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" onClick={onEdit}><Edit3 size={14} /> Editar</Button>{!role.isSystem ? <Button size="sm" variant="danger" onClick={onDelete}>Eliminar</Button> : null}</div>
    </article>
  );
}

export function AccessManagementPage() {
  const [data, setData] = useState<AccessManagementDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('users');
  const [userViewMode, setUserViewMode] = useState<UserViewMode>('grid');
  const [query, setQuery] = useState('');
  const [userModal, setUserModal] = useState<AccessUser | 'new' | null>(null);
  const [roleModal, setRoleModal] = useState<AccessRole | 'new' | null>(null);
  const [passwordUser, setPasswordUser] = useState<AccessUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(background = false) {
    background ? setRefreshing(true) : setLoading(true);
    try {
      setData(await getAccessManagementDashboard());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar usuarios y roles.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const users = useMemo(() => data.users.filter((user) => !normalizedQuery || [user.fullName, user.email ?? '', user.phone ?? '', user.accessStatus, ...user.roles.map((role) => role.name), ...user.roles.map((role) => role.code)].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery))), [data.users, normalizedQuery]);
  const roles = useMemo(() => data.roles.filter((role) => !normalizedQuery || [role.name, role.code, role.description ?? ''].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery))), [data.roles, normalizedQuery]);
  const activeUsers = data.users.filter((user) => user.accessStatus === 'active').length;
  const pendingUsers = data.users.filter((user) => user.accessStatus === 'pending_activation').length;
  const deliveryUsers = data.users.filter((user) => user.roles.some((role) => role.code === 'delivery') && user.accessStatus !== 'archived').length;
  const customRoles = data.roles.filter((role) => !role.isSystem).length;

  async function executeConfirm() {
    if (!confirmState) return;
    setBusy(true);
    try {
      if (confirmState.type === 'set-active') {
        await setAccessUserActive(confirmState.user.id, confirmState.active);
        toast.success(confirmState.active ? 'Usuario activado.' : 'Usuario desactivado.');
      } else if (confirmState.type === 'archive') {
        await archiveAccessUser(confirmState.user.id);
        toast.success('Usuario archivado. Se conserva todo su historial.');
      } else if (confirmState.type === 'restore') {
        await restoreAccessUser(confirmState.user.id);
        toast.success('Usuario restaurado.');
      } else {
        await deleteAccessRole(confirmState.role.id);
        toast.success('Rol eliminado.');
      }
      setConfirmState(null);
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!passwordUser) return;
    if (newPassword.length < 8) return toast.warning('La contraseña debe tener al menos 8 caracteres.');
    setBusy(true);
    try {
      await resetAccessUserPassword(passwordUser.id, newPassword);
      toast.success('Contraseña actualizada.');
      setPasswordUser(null);
      setNewPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  const confirmCopy = confirmState?.type === 'set-active'
    ? { title: confirmState.active ? 'Activar usuario' : 'Desactivar usuario', description: `${confirmState.user.fullName} ${confirmState.active ? 'volverá a poder acceder a los paneles habilitados por sus roles.' : 'dejará de poder operar en los paneles internos hasta que lo reactives.'}`, label: confirmState.active ? 'Activar' : 'Desactivar', tone: confirmState.active ? 'default' as const : 'danger' as const }
    : confirmState?.type === 'archive'
      ? { title: 'Archivar usuario', description: `Se desactivará a ${confirmState.user.fullName}, pero se conservarán sus roles, entregas, movimientos e historial para auditoría.`, label: 'Archivar', tone: 'danger' as const }
      : confirmState?.type === 'restore'
        ? { title: 'Restaurar usuario', description: `${confirmState.user.fullName} volverá a su estado anterior. Si todavía no verificó el email seguirá pendiente de activación.`, label: 'Restaurar', tone: 'default' as const }
        : confirmState?.type === 'delete-role'
          ? { title: 'Eliminar rol', description: `El rol ${confirmState.role.name} se eliminará definitivamente. Sólo es posible si no está asignado a ningún usuario.`, label: 'Eliminar rol', tone: 'danger' as const }
          : { title: '', description: '', label: 'Confirmar', tone: 'default' as const };

  return (
    <div className="min-w-0">
      <AdminPageHeader
        eyebrow="Seguridad"
        title="Usuarios y roles"
        description="Administrá identidades, invitaciones, roles y permisos con un modelo escalable de acceso basado en RBAC."
        actions={<><Button variant="secondary" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar</Button><Button onClick={() => tab === 'users' ? setUserModal('new') : setRoleModal('new')}><Plus size={16} /> {tab === 'users' ? 'Invitar usuario' : 'Nuevo rol'}</Button></>}
      />

      {loading ? <AccessManagementSkeleton /> : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Users} label="Usuarios" value={String(data.users.length)} helper={`${pendingUsers} pendientes de activación`} />
            <Metric icon={UserRoundCheck} label="Usuarios activos" value={String(activeUsers)} helper="Email verificado y cuenta habilitada" />
            <Metric icon={Bike} label="Repartidores" value={String(deliveryUsers)} helper="Usuarios con rol Delivery" />
            <Metric icon={ShieldCheck} label="Roles" value={String(data.roles.length)} helper={`${customRoles} roles personalizados`} />
          </section>

          <div className="mb-5 flex min-w-0 gap-2 overflow-x-auto rounded-sm border border-neutral-200 bg-white p-2 shadow-sm">
            <button onClick={() => { setTab('users'); setQuery(''); }} className={`inline-flex cursor-pointer items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-bold transition ${tab === 'users' ? 'bg-central-carbon text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}><Users size={16} /> Usuarios</button>
            <button onClick={() => { setTab('roles'); setQuery(''); }} className={`inline-flex cursor-pointer items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-bold transition ${tab === 'roles' ? 'bg-central-carbon text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}><Shield size={16} /> Roles y permisos</button>
          </div>

          <div className="mb-5 flex max-w-xl items-center gap-2 rounded-sm border border-neutral-200 bg-white px-3 shadow-sm focus-within:border-central-orange focus-within:ring-2 focus-within:ring-central-orange/10"><Search size={16} className="text-neutral-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'users' ? 'Buscar usuario, email, teléfono, estado o rol…' : 'Buscar rol por nombre, código o descripción…'} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400" /></div>

          {tab === 'users' ? (
            <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-black text-central-carbon">Cuentas de usuario</h2><p className="text-xs text-neutral-500">Las altas se realizan por invitación; el usuario verifica su email y define su propia contraseña.</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-[12px] bg-[#F2F2F7] p-1" role="group" aria-label="Cambiar vista de usuarios">
                    <button
                      type="button"
                      onClick={() => setUserViewMode('grid')}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-semibold transition ${userViewMode === 'grid' ? 'bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#8E8E93] hover:text-[#636366]'}`}
                      aria-pressed={userViewMode === 'grid'}
                    >
                      <LayoutGrid size={14} /> Cuadros
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserViewMode('table')}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-semibold transition ${userViewMode === 'table' ? 'bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#8E8E93] hover:text-[#636366]'}`}
                      aria-pressed={userViewMode === 'table'}
                    >
                      <List size={15} /> Tabla
                    </button>
                  </div>
                  <Button onClick={() => setUserModal('new')}><MailCheck size={16} /> Invitar usuario</Button>
                </div>
              </div>

              {userViewMode === 'grid' ? (
                <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {users.map((user) => <UserCard key={user.id} user={user} onEdit={() => setUserModal(user)} onPassword={() => { setPasswordUser(user); setNewPassword(''); }} onConfirm={setConfirmState} />)}
                  {users.length === 0 ? <div className="md:col-span-2 2xl:col-span-3 rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">No hay usuarios que coincidan con la búsqueda.</div> : null}
                </div>
              ) : (
                <div className="min-w-0 overflow-hidden rounded-[16px] border border-[#E5E5EA] bg-white">
                  <div className="hidden grid-cols-[minmax(0,1.55fr)_minmax(0,.8fr)_minmax(0,1.05fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1.35fr)] items-center gap-3 bg-[#F7F7FA] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8E8E93] xl:grid">
                    <span>Usuario</span><span>Roles</span><span>Delivery</span><span>Creado</span><span>Último ingreso</span><span className="text-right">Acciones</span>
                  </div>
                  {users.map((user) => <UserTableRow key={user.id} user={user} onEdit={() => setUserModal(user)} onPassword={() => { setPasswordUser(user); setNewPassword(''); }} onConfirm={setConfirmState} />)}
                  {users.length === 0 ? <div className="p-10 text-center text-sm text-neutral-500">No hay usuarios que coincidan con la búsqueda.</div> : null}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-central-carbon">Roles y permisos</h2><p className="text-xs text-neutral-500">Los roles del sistema protegen las funciones esenciales; podés crear roles adicionales para futuras áreas.</p></div><Button onClick={() => setRoleModal('new')}><Plus size={16} /> Nuevo rol</Button></div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {roles.map((role) => <RoleCard key={role.id} role={role} onEdit={() => setRoleModal(role)} onDelete={() => setConfirmState({ type: 'delete-role', role })} />)}
                {roles.length === 0 ? <div className="md:col-span-2 2xl:col-span-3 rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">No hay roles que coincidan con la búsqueda.</div> : null}
              </div>
            </section>
          )}
        </>
      )}

      {userModal ? <AccessUserModal user={userModal === 'new' ? undefined : userModal} roles={data.roles} onClose={() => setUserModal(null)} onSaved={() => void load(true)} /> : null}
      {roleModal ? <AccessRoleModal role={roleModal === 'new' ? undefined : roleModal} permissions={data.permissions} onClose={() => setRoleModal(null)} onSaved={() => void load(true)} /> : null}

      <Modal open={Boolean(passwordUser)} onClose={() => { setPasswordUser(null); setNewPassword(''); }} title="Cambiar contraseña" size="sm" theme="light">
        <p className="mb-4 text-sm leading-6 text-neutral-600">Definí una nueva contraseña para <strong>{passwordUser?.fullName}</strong>. El cambio se aplica inmediatamente.</p>
        <label><span className={labelClass}>Nueva contraseña</span><PasswordInput variant="light" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoFocus autoComplete="new-password" /></label>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => { setPasswordUser(null); setNewPassword(''); }}>Cancelar</Button><Button onClick={() => void resetPassword()} disabled={busy}>Guardar contraseña</Button></div>
      </Modal>

      <ConfirmDialog open={Boolean(confirmState)} title={confirmCopy.title} description={confirmCopy.description} confirmLabel={confirmCopy.label} tone={confirmCopy.tone} isLoading={busy} onConfirm={executeConfirm} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
