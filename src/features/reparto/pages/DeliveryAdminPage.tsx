'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Bike,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Modal } from '@/shared/components/ui/Modal';
import { SearchableSelect } from '@/shared/components/ui/SearchableSelect';
import { Select } from '@/shared/components/ui/Select';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import { DeliveryAdminSkeleton } from '../components/DeliveryAdminSkeleton';
import { DeliveryMetricCard } from '../components/DeliveryMetricCard';
import {
  assignDelivery,
  cancelDeliveryAssignment,
  cancelDeliverySettlement,
  createDeliverySettlement,
  getDeliveryAdminDashboard,
  markDeliverySettlementPaid,
  resetDeliveryDriverPassword,
  saveDeliveryDriver,
  toggleDeliveryDriver,
} from '../services/delivery-admin.service';
import type {
  DeliveryAdminDashboard,
  DeliveryAssignment,
  DeliveryAssignmentStatus,
  DeliveryDriver,
  DeliveryVehicleType,
  DriverFormPayload,
} from '../types/delivery-management.types';

type Tab = 'operation' | 'drivers' | 'settlements';
type PendingConfirmation =
  | { type: 'cancel-assignment'; assignment: DeliveryAssignment }
  | { type: 'toggle-driver'; driver: DeliveryDriver }
  | { type: 'pay-settlement'; id: string }
  | { type: 'cancel-settlement'; id: string };

const EMPTY: DeliveryAdminDashboard = {
  summary: { unassignedOrders: 0, activeAssignments: 0, activeDrivers: 0, pendingCommission: 0, cashPending: 0 },
  drivers: [],
  unassignedOrders: [],
  assignments: [],
  settlements: [],
};

const fieldClass = 'h-10 w-full rounded-sm border border-neutral-200 bg-white px-3 text-sm text-central-carbon outline-none transition focus:border-central-orange focus:ring-2 focus:ring-central-orange/15';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500';

const STATUS_LABELS: Record<DeliveryAssignmentStatus, string> = {
  assigned: 'Asignado',
  accepted: 'Aceptado',
  picked_up: 'Retirado',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const VEHICLE_OPTIONS = [
  { value: 'moto', label: 'Moto' },
  { value: 'auto', label: 'Auto' },
  { value: 'bici', label: 'Bicicleta' },
  { value: 'otro', label: 'Otro' },
] as const;

function statusClass(status: DeliveryAssignmentStatus) {
  if (status === 'delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'cancelled') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'in_transit' || status === 'picked_up') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function DriverModal({ driver, onClose, onSaved }: { driver?: DeliveryDriver; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<DriverFormPayload>({
    driverId: driver?.id,
    fullName: driver?.fullName ?? '',
    email: driver?.email ?? '',
    password: '',
    phone: driver?.phone ?? '',
    vehicleType: driver?.vehicleType ?? 'moto',
    commissionPercent: driver?.commissionPercent ?? 0,
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!driver && (!form.password || form.password.length < 8)) {
      toast.warning('La contraseña inicial debe tener al menos 8 caracteres.');
      return;
    }
    if (form.commissionPercent < 0 || form.commissionPercent > 100) {
      toast.warning('La comisión debe estar entre 0% y 100%.');
      return;
    }

    setSaving(true);
    try {
      await saveDeliveryDriver(form);
      toast.success(driver ? 'Repartidor actualizado.' : 'Repartidor creado correctamente.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el repartidor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={driver ? 'Editar repartidor' : 'Nuevo repartidor'} size="md" theme="light">
      <form onSubmit={submit}>
        <div className="mb-5 rounded-sm border border-central-orange/15 bg-central-orange/[.05] p-3 text-xs leading-5 text-neutral-600">
          La cuenta de acceso, los datos operativos y la tarifa se gestionan por separado para conservar el historial de entregas y comisiones.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Nombre y apellido</span>
            <input className={fieldClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </label>
          <label>
            <span className={labelClass}>Email de acceso</span>
            <input type="email" className={fieldClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            <span className={labelClass}>Teléfono</span>
            <input className={fieldClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          {!driver ? (
            <label className="sm:col-span-2">
              <span className={labelClass}>Contraseña inicial</span>
              <input type="password" minLength={8} className={fieldClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            </label>
          ) : null}
          <div>
            <span className={labelClass}>Vehículo</span>
            <Select
              variant="light"
              value={form.vehicleType}
              options={VEHICLE_OPTIONS}
              onValueChange={(value) => setForm({ ...form, vehicleType: value as DeliveryVehicleType })}
              aria-label="Tipo de vehículo"
            />
          </div>
          <label>
            <span className={labelClass}>Comisión sobre el envío (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className={fieldClass}
              value={form.commissionPercent}
              onChange={(event) => setForm({ ...form, commissionPercent: Number(event.target.value) })}
              required
            />
          </label>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : driver ? 'Guardar cambios' : 'Crear repartidor'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function DeliveryAdminPage() {
  const [data, setData] = useState<DeliveryAdminDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('operation');
  const [query, setQuery] = useState('');
  const [driverModal, setDriverModal] = useState<DeliveryDriver | 'new' | null>(null);
  const [resetDriver, setResetDriver] = useState<DeliveryDriver | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [driverByOrder, setDriverByOrder] = useState<Record<string, string>>({});
  const [driverByAssignment, setDriverByAssignment] = useState<Record<string, string>>({});
  const [settlementDriver, setSettlementDriver] = useState('');
  const [settlementFrom, setSettlementFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [settlementTo, setSettlementTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const activeDrivers = useMemo(() => data.drivers.filter((driver) => driver.active && driver.commissionPercent !== null), [data.drivers]);
  const activeAssignments = useMemo(() => data.assignments.filter((item) => ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(item.status)), [data.assignments]);
  const activeDriverOptions = useMemo(() => activeDrivers.map((driver) => ({ value: driver.id, label: `${driver.fullName} · ${driver.commissionPercent}%` })), [activeDrivers]);
  const allDriverOptions = useMemo(() => data.drivers.map((driver) => ({ value: driver.id, label: `${driver.fullName}${driver.active ? '' : ' · inactivo'}`, disabled: !driver.active })), [data.drivers]);

  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const filteredOrders = useMemo(() => {
    if (!normalizedQuery) return data.unassignedOrders;
    return data.unassignedOrders.filter((order) => [order.orderCode, order.customerName, order.customerPhone, order.address ?? ''].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery)));
  }, [data.unassignedOrders, normalizedQuery]);
  const filteredAssignments = useMemo(() => {
    if (!normalizedQuery) return activeAssignments;
    return activeAssignments.filter((item) => [item.orderCode, item.customerName, item.customerPhone, item.address ?? '', item.driverName].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery)));
  }, [activeAssignments, normalizedQuery]);
  const filteredDrivers = useMemo(() => {
    if (!normalizedQuery) return data.drivers;
    return data.drivers.filter((driver) => [driver.fullName, driver.email ?? '', driver.phone ?? ''].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery)));
  }, [data.drivers, normalizedQuery]);

  async function load(background = false) {
    background ? setRefreshing(true) : setLoading(true);
    try {
      setData(await getDeliveryAdminDashboard());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el módulo de delivery.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleAssign(orderId: string, driverId: string, assignmentId?: string) {
    if (!driverId) return toast.info('Seleccioná un repartidor.');
    setBusyId(assignmentId ?? orderId);
    try {
      await assignDelivery(orderId, driverId, assignmentId ? 'Reasignación desde panel de delivery' : undefined);
      toast.success(assignmentId ? 'Pedido reasignado.' : 'Pedido asignado.');
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo asignar el pedido.');
    } finally {
      setBusyId(null);
    }
  }

  async function executeConfirmation() {
    if (!pendingConfirmation) return;
    const action = pendingConfirmation;
    const actionId = action.type === 'cancel-assignment' ? action.assignment.id : action.type === 'toggle-driver' ? action.driver.id : action.id;
    setBusyId(actionId);
    try {
      if (action.type === 'cancel-assignment') {
        await cancelDeliveryAssignment(action.assignment.id, 'Desasignado desde administración');
        toast.success('Asignación cancelada.');
      } else if (action.type === 'toggle-driver') {
        await toggleDeliveryDriver(action.driver.id, !action.driver.active);
        toast.success(action.driver.active ? 'Repartidor desactivado.' : 'Repartidor activado.');
      } else if (action.type === 'pay-settlement') {
        await markDeliverySettlementPaid(action.id);
        toast.success('Liquidación cerrada como pagada.');
      } else {
        await cancelDeliverySettlement(action.id);
        toast.success('Liquidación cancelada.');
      }
      setPendingConfirmation(null);
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword() {
    if (!resetDriver) return;
    if (newPassword.length < 8) return toast.warning('La contraseña debe tener al menos 8 caracteres.');
    setBusyId(resetDriver.id);
    try {
      await resetDeliveryDriverPassword(resetDriver.id, newPassword);
      toast.success('Contraseña actualizada.');
      setResetDriver(null);
      setNewPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateSettlement() {
    if (!settlementDriver) return toast.info('Seleccioná un repartidor.');
    if (!settlementFrom || !settlementTo || settlementFrom > settlementTo) return toast.warning('Revisá el período seleccionado.');
    setBusyId('settlement-create');
    try {
      await createDeliverySettlement(settlementDriver, settlementFrom, settlementTo);
      toast.success('Liquidación generada en borrador.');
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar la liquidación.');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: 'operation', label: 'Operación', icon: Route },
    { id: 'drivers', label: 'Repartidores', icon: Users },
    { id: 'settlements', label: 'Liquidaciones', icon: WalletCards },
  ];

  const confirmCopy = pendingConfirmation?.type === 'cancel-assignment'
    ? { title: 'Quitar asignación', description: `El pedido ${pendingConfirmation.assignment.orderCode} volverá a la cola sin asignar. El historial de la asignación anterior se conservará.`, label: 'Quitar asignación', tone: 'danger' as const }
    : pendingConfirmation?.type === 'toggle-driver'
      ? { title: pendingConfirmation.driver.active ? 'Desactivar repartidor' : 'Activar repartidor', description: `${pendingConfirmation.driver.fullName} ${pendingConfirmation.driver.active ? 'dejará de estar disponible para nuevas asignaciones' : 'volverá a estar disponible para nuevas asignaciones'}.`, label: pendingConfirmation.driver.active ? 'Desactivar' : 'Activar', tone: pendingConfirmation.driver.active ? 'danger' as const : 'default' as const }
      : pendingConfirmation?.type === 'pay-settlement'
        ? { title: 'Confirmar liquidación', description: 'La liquidación quedará cerrada como pagada y conciliada. Esta acción no modifica los pedidos históricos.', label: 'Confirmar pago', tone: 'default' as const }
        : { title: 'Cancelar liquidación', description: 'El borrador se cancelará y sus entregas volverán a quedar disponibles para una liquidación posterior.', label: 'Cancelar liquidación', tone: 'danger' as const };

  return (
    <div className="min-w-0">
      <AdminPageHeader
        eyebrow="Delivery"
        title="Centro de operaciones de reparto"
        description="Asignación, seguimiento, comisiones y liquidaciones separadas del ciclo comercial del pedido."
        actions={(
          <>
            <Button variant="secondary" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
            </Button>
            <Button onClick={() => setDriverModal('new')}><UserPlus size={16} /> Nuevo repartidor</Button>
          </>
        )}
      />

      {loading ? <DeliveryAdminSkeleton /> : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <DeliveryMetricCard icon={PackageCheck} label="Sin asignar" value={String(data.summary.unassignedOrders)} detail="Pedidos delivery esperando repartidor" />
            <DeliveryMetricCard icon={Truck} label="En operación" value={String(data.summary.activeAssignments)} detail="Asignaciones abiertas ahora" />
            <DeliveryMetricCard icon={Users} label="Repartidores activos" value={String(data.summary.activeDrivers)} detail="Habilitados para recibir pedidos" />
            <DeliveryMetricCard icon={BadgeDollarSign} label="Comisión pendiente" value={formatCurrency(data.summary.pendingCommission)} detail="Ganancias aún no conciliadas" />
            <DeliveryMetricCard icon={CircleDollarSign} label="Efectivo pendiente" value={formatCurrency(data.summary.cashPending)} detail="Cobrado por repartidores a rendir" />
          </section>

          <div className="mb-6 flex min-w-0 gap-2 overflow-x-auto rounded-sm border border-neutral-200 bg-white p-2 shadow-sm">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setTab(id); setQuery(''); }} className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm px-4 py-2.5 text-sm font-bold transition ${tab === id ? 'bg-central-carbon text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-central-carbon'}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {tab !== 'settlements' ? (
            <div className="mb-5 flex max-w-xl items-center gap-2 rounded-sm border border-neutral-200 bg-white px-3 shadow-sm focus-within:border-central-orange focus-within:ring-2 focus-within:ring-central-orange/10">
              <Search size={16} className="shrink-0 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === 'operation' ? 'Buscar pedido, cliente, teléfono o dirección…' : 'Buscar repartidor, email o teléfono…'}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
            </div>
          ) : null}

          {tab === 'operation' ? (
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section className="min-w-0 rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><h2 className="font-black text-central-carbon">Pedidos sin asignar</h2><p className="text-xs text-neutral-500">Solo pedidos delivery abiertos.</p></div>
                  <span className="rounded-full bg-central-orange/10 px-3 py-1 text-xs font-black text-central-orange">{filteredOrders.length}</span>
                </div>
                <div className="custom-scrollbar max-h-[68vh] space-y-3 overflow-y-auto pr-1">
                  {filteredOrders.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">No hay pedidos que coincidan con la búsqueda.</div> : filteredOrders.map((order) => (
                    <article key={order.id} className="rounded-sm border border-neutral-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0"><p className="break-words font-black text-central-carbon">{order.orderCode} · {order.customerName}</p><p className="mt-1 break-words text-xs leading-5 text-neutral-500">{order.address || 'Dirección sin texto'} · {order.distanceKm?.toFixed(1) ?? '—'} km</p></div>
                        <div className="text-right"><p className="font-black">{formatCurrency(order.total)}</p><p className="text-xs text-neutral-500">Envío {formatCurrency(order.deliveryCost)}</p></div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <SearchableSelect
                          value={driverByOrder[order.id]}
                          options={activeDriverOptions}
                          onValueChange={(value) => setDriverByOrder((current) => ({ ...current, [order.id]: value }))}
                          placeholder="Seleccionar repartidor"
                          searchPlaceholder="Buscar repartidor…"
                          emptyMessage="No hay repartidores activos."
                          aria-label={`Repartidor para ${order.orderCode}`}
                        />
                        <Button size="sm" onClick={() => void handleAssign(order.id, driverByOrder[order.id] ?? '')} disabled={busyId === order.id}>Asignar</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4"><h2 className="font-black text-central-carbon">Repartos en curso</h2><p className="text-xs text-neutral-500">Los estados logísticos se registran sin mezclar el historial comercial del pedido.</p></div>
                <div className="custom-scrollbar max-h-[68vh] space-y-3 overflow-y-auto pr-1">
                  {filteredAssignments.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">No hay repartos activos que coincidan con la búsqueda.</div> : filteredAssignments.map((item) => (
                    <article key={item.id} className="rounded-sm border border-neutral-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="break-words font-black text-central-carbon">{item.orderCode} · {item.customerName}</p><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(item.status)}`}>{STATUS_LABELS[item.status]}</span></div>
                          <p className="mt-1 text-xs text-neutral-500">{item.driverName} · comisión {formatCurrency(item.commissionAmount)} ({item.commissionPercent}%)</p>
                        </div>
                        <div className="text-right"><p className="text-sm font-bold">{item.paymentMethod === 'efectivo' ? `Cobrar ${formatCurrency(item.cashToCollect)}` : 'Transferencia'}</p><p className="text-xs text-neutral-500">Asignado {formatDateTime(item.assignedAt)}</p></div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <SearchableSelect
                          value={driverByAssignment[item.id] ?? item.driverId}
                          options={activeDriverOptions}
                          onValueChange={(value) => setDriverByAssignment((current) => ({ ...current, [item.id]: value }))}
                          searchPlaceholder="Buscar repartidor…"
                          aria-label={`Reasignar ${item.orderCode}`}
                        />
                        <Button size="sm" variant="secondary" onClick={() => void handleAssign(item.orderId, driverByAssignment[item.id] ?? item.driverId, item.id)} disabled={busyId === item.id}><RotateCcw size={14} /> Reasignar</Button>
                        <Button size="sm" variant="danger" onClick={() => setPendingConfirmation({ type: 'cancel-assignment', assignment: item })} disabled={busyId === item.id}>Quitar</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {tab === 'drivers' ? (
            <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-central-carbon">Equipo de reparto</h2><p className="text-xs text-neutral-500">La tarifa vigente se versiona; cada asignación referencia la tarifa histórica que le corresponde.</p></div><Button onClick={() => setDriverModal('new')}><UserPlus size={16} /> Alta</Button></div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredDrivers.map((driver) => (
                  <article key={driver.id} className={`rounded-sm border p-4 ${driver.active ? 'border-neutral-200' : 'border-neutral-200 bg-neutral-50 opacity-75'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-central-orange/10 text-central-orange"><Bike size={17} /></span><div className="min-w-0"><p className="truncate font-black text-central-carbon">{driver.fullName}</p><p className="truncate text-xs text-neutral-500">{driver.email || 'Sin email'}</p></div></div></div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${driver.active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>{driver.active ? 'Activo' : 'Inactivo'}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-sm bg-neutral-50 p-3 text-center"><div><p className="text-[11px] text-neutral-500">Comisión</p><p className="mt-1 text-sm font-black">{driver.commissionPercent ?? 0}%</p></div><div><p className="text-[11px] text-neutral-500">Activos</p><p className="mt-1 text-sm font-black">{driver.activeAssignments}</p></div><div><p className="text-[11px] text-neutral-500">Pendiente</p><p className="mt-1 text-sm font-black">{formatCurrency(driver.pendingCommission)}</p></div></div>
                    <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setDriverModal(driver)}><Edit3 size={14} /> Editar</Button><Button size="sm" variant="secondary" onClick={() => { setResetDriver(driver); setNewPassword(''); }} disabled={busyId === driver.id}><ShieldCheck size={14} /> Clave</Button><Button size="sm" variant={driver.active ? 'danger' : 'dark'} onClick={() => setPendingConfirmation({ type: 'toggle-driver', driver })} disabled={busyId === driver.id}>{driver.active ? 'Desactivar' : 'Activar'}</Button></div>
                  </article>
                ))}
                {filteredDrivers.length === 0 ? <div className="md:col-span-2 2xl:col-span-3 rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">No hay repartidores que coincidan con la búsqueda.</div> : null}
              </div>
            </section>
          ) : null}

          {tab === 'settlements' ? (
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-5"><h2 className="font-black text-central-carbon">Nueva liquidación</h2><p className="text-xs text-neutral-500">Consolida únicamente entregas finalizadas todavía no incluidas en otra liquidación.</p></div>
                <div className="space-y-4">
                  <div><span className={labelClass}>Repartidor</span><SearchableSelect value={settlementDriver} options={allDriverOptions} onValueChange={setSettlementDriver} placeholder="Seleccionar repartidor" searchPlaceholder="Buscar repartidor…" /></div>
                  <label><span className={labelClass}>Desde</span><input type="date" className={fieldClass} value={settlementFrom} onChange={(event) => setSettlementFrom(event.target.value)} /></label>
                  <label><span className={labelClass}>Hasta</span><input type="date" className={fieldClass} value={settlementTo} onChange={(event) => setSettlementTo(event.target.value)} /></label>
                  <Button className="w-full" onClick={() => void handleCreateSettlement()} disabled={busyId === 'settlement-create'}><WalletCards size={16} /> Generar borrador</Button>
                </div>
                <div className="mt-5 rounded-sm border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-700"><strong>Saldo neto:</strong> comisión ganada menos efectivo cobrado. Un saldo negativo indica efectivo a rendir al negocio; uno positivo, importe a favor del repartidor.</div>
              </section>

              <section className="min-w-0 rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4"><h2 className="font-black text-central-carbon">Historial de liquidaciones</h2><p className="text-xs text-neutral-500">Borradores, cierres pagados y conciliación de efectivo.</p></div>
                <div className="custom-scrollbar max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                  {data.settlements.map((item) => (
                    <article key={item.id} className="rounded-sm border border-neutral-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-central-carbon">{item.driverName}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : item.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{item.status === 'paid' ? 'Pagada' : item.status === 'cancelled' ? 'Cancelada' : 'Borrador'}</span></div><p className="mt-1 text-xs text-neutral-500">{new Date(item.periodFrom).toLocaleDateString('es-AR')} — {new Date(item.periodTo).toLocaleDateString('es-AR')} · {item.deliveries} entregas</p></div><div className="text-right"><p className="font-black">{formatCurrency(item.commissionTotal)} comisión</p><p className="text-xs text-neutral-500">Efectivo {formatCurrency(item.cashCollected)}</p></div></div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-neutral-50 px-3 py-2"><p className="text-sm font-bold">Saldo neto: <span className={item.netBalance < 0 ? 'text-red-600' : 'text-emerald-700'}>{formatCurrency(item.netBalance)}</span></p>{item.status === 'draft' ? <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setPendingConfirmation({ type: 'cancel-settlement', id: item.id })} disabled={busyId === item.id}>Cancelar</Button><Button size="sm" onClick={() => setPendingConfirmation({ type: 'pay-settlement', id: item.id })} disabled={busyId === item.id}><CheckCircle2 size={14} /> Confirmar pago</Button></div> : <span className="text-xs text-neutral-500">{item.paidAt ? `Cerrada ${formatDateTime(item.paidAt)}` : 'Sin movimiento pendiente'}</span>}</div>
                    </article>
                  ))}
                  {data.settlements.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">Todavía no se generaron liquidaciones.</div> : null}
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}

      {driverModal ? <DriverModal driver={driverModal === 'new' ? undefined : driverModal} onClose={() => setDriverModal(null)} onSaved={() => void load(true)} /> : null}

      <Modal open={Boolean(resetDriver)} onClose={() => { setResetDriver(null); setNewPassword(''); }} title="Cambiar contraseña" size="sm" theme="light">
        <div>
          <p className="mb-4 text-sm leading-6 text-neutral-600">Definí una nueva contraseña para <strong>{resetDriver?.fullName}</strong>. El cambio se aplica inmediatamente al acceso del repartidor.</p>
          <label><span className={labelClass}>Nueva contraseña</span><input type="password" minLength={8} className={fieldClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoFocus /></label>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => { setResetDriver(null); setNewPassword(''); }}>Cancelar</Button><Button onClick={() => void handleResetPassword()} disabled={!resetDriver || busyId === resetDriver.id}>Guardar contraseña</Button></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingConfirmation)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        tone={confirmCopy.tone}
        isLoading={Boolean(pendingConfirmation && busyId)}
        onConfirm={executeConfirmation}
        onCancel={() => setPendingConfirmation(null)}
      />
    </div>
  );
}
