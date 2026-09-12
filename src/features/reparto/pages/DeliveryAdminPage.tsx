'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Bike,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Edit3,
  MapPin,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Button } from '@/shared/components/ui/Button';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
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

function statusClass(status: DeliveryAssignmentStatus) {
  if (status === 'delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'cancelled') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'in_transit' || status === 'picked_up') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function Metric({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-central-carbon">{value}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{detail}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-central-orange/10 text-central-orange"><Icon size={18} /></span>
      </div>
    </article>
  );
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-xl bg-white p-5 shadow-2xl sm:rounded-sm sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-central-orange">Repartidores</p>
            <h2 className="mt-1 text-xl font-black text-central-carbon">{driver ? 'Editar repartidor' : 'Nuevo repartidor'}</h2>
            <p className="mt-1 text-sm text-neutral-500">Cuenta, vehículo y comisión quedan separados del historial de entregas.</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-sm p-2 text-neutral-500 hover:bg-neutral-100"><X size={20} /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={labelClass}>Nombre y apellido</span><input className={fieldClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
          <label><span className={labelClass}>Email de acceso</span><input type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label><span className={labelClass}>Teléfono</span><input className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          {!driver ? <label className="sm:col-span-2"><span className={labelClass}>Contraseña inicial</span><input type="password" minLength={8} className={fieldClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label> : null}
          <label><span className={labelClass}>Vehículo</span><select className={fieldClass} value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value as DeliveryVehicleType })}><option value="moto">Moto</option><option value="auto">Auto</option><option value="bici">Bicicleta</option><option value="otro">Otro</option></select></label>
          <label><span className={labelClass}>Comisión sobre el delivery (%)</span><input type="number" min="0" max="100" step="0.01" className={fieldClass} value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })} required /></label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : driver ? 'Guardar cambios' : 'Crear repartidor'}</Button>
        </div>
      </form>
    </div>
  );
}

export function DeliveryAdminPage() {
  const [data, setData] = useState<DeliveryAdminDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('operation');
  const [driverModal, setDriverModal] = useState<DeliveryDriver | 'new' | null>(null);
  const [driverByOrder, setDriverByOrder] = useState<Record<string, string>>({});
  const [driverByAssignment, setDriverByAssignment] = useState<Record<string, string>>({});
  const [settlementDriver, setSettlementDriver] = useState('');
  const [settlementFrom, setSettlementFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [settlementTo, setSettlementTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeDrivers = useMemo(() => data.drivers.filter((driver) => driver.active && driver.commissionPercent !== null), [data.drivers]);
  const activeAssignments = useMemo(() => data.assignments.filter((item) => ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(item.status)), [data.assignments]);

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
    } finally { setBusyId(null); }
  }

  async function handleCancelAssignment(item: DeliveryAssignment) {
    if (!confirm(`¿Quitar la asignación del pedido ${item.orderCode}?`)) return;
    setBusyId(item.id);
    try {
      await cancelDeliveryAssignment(item.id, 'Desasignado desde administración');
      toast.success('Asignación cancelada.');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cancelar.'); }
    finally { setBusyId(null); }
  }

  async function handleToggleDriver(driver: DeliveryDriver) {
    if (!confirm(`${driver.active ? 'Desactivar' : 'Activar'} a ${driver.fullName}?`)) return;
    setBusyId(driver.id);
    try {
      await toggleDeliveryDriver(driver.id, !driver.active);
      toast.success(driver.active ? 'Repartidor desactivado.' : 'Repartidor activado.');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo actualizar.'); }
    finally { setBusyId(null); }
  }

  async function handleResetPassword(driver: DeliveryDriver) {
    const password = prompt(`Nueva contraseña para ${driver.fullName} (mínimo 8 caracteres):`);
    if (!password) return;
    if (password.length < 8) return toast.warning('La contraseña debe tener al menos 8 caracteres.');
    setBusyId(driver.id);
    try {
      await resetDeliveryDriverPassword(driver.id, password);
      toast.success('Contraseña actualizada.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.'); }
    finally { setBusyId(null); }
  }

  async function handleCreateSettlement() {
    if (!settlementDriver) return toast.info('Seleccioná un repartidor.');
    if (!settlementFrom || !settlementTo || settlementFrom > settlementTo) return toast.warning('Revisá el período seleccionado.');
    setBusyId('settlement-create');
    try {
      await createDeliverySettlement(settlementDriver, settlementFrom, settlementTo);
      toast.success('Liquidación generada en borrador.');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo generar la liquidación.'); }
    finally { setBusyId(null); }
  }

  async function handleSettlementAction(id: string, action: 'pay' | 'cancel') {
    if (!confirm(action === 'pay' ? '¿Confirmar esta liquidación como pagada/reconciliada?' : '¿Cancelar este borrador de liquidación?')) return;
    setBusyId(id);
    try {
      if (action === 'pay') await markDeliverySettlementPaid(id); else await cancelDeliverySettlement(id);
      toast.success(action === 'pay' ? 'Liquidación cerrada como pagada.' : 'Liquidación cancelada.');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la liquidación.'); }
    finally { setBusyId(null); }
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: 'operation', label: 'Operación', icon: Route },
    { id: 'drivers', label: 'Repartidores', icon: Users },
    { id: 'settlements', label: 'Liquidaciones', icon: WalletCards },
  ];

  return (
    <div className="min-w-0">
      <AdminPageHeader
        eyebrow="Delivery"
        title="Centro de operaciones de reparto"
        description="Asignación, seguimiento, comisiones y liquidaciones separadas del ciclo comercial del pedido."
        actions={<><Button variant="secondary" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar</Button><Button onClick={() => setDriverModal('new')}><UserPlus size={16} /> Nuevo repartidor</Button></>}
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={PackageCheck} label="Sin asignar" value={String(data.summary.unassignedOrders)} detail="Pedidos delivery esperando repartidor" />
        <Metric icon={Truck} label="En operación" value={String(data.summary.activeAssignments)} detail="Asignaciones abiertas ahora" />
        <Metric icon={Users} label="Repartidores activos" value={String(data.summary.activeDrivers)} detail="Habilitados para recibir pedidos" />
        <Metric icon={BadgeDollarSign} label="Comisión pendiente" value={formatCurrency(data.summary.pendingCommission)} detail="Ganancias aún no conciliadas" />
        <Metric icon={CircleDollarSign} label="Efectivo pendiente" value={formatCurrency(data.summary.cashPending)} detail="Cobrado por repartidores a rendir" />
      </section>

      <div className="mb-6 flex min-w-0 gap-2 overflow-x-auto rounded-sm border border-neutral-200 bg-white p-2 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm px-4 py-2.5 text-sm font-bold transition ${tab === id ? 'bg-central-carbon text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-central-carbon'}`}><Icon size={16} /> {label}</button>)}
      </div>

      {loading ? <div className="rounded-sm border border-neutral-200 bg-white p-12 text-center text-sm font-semibold text-neutral-500 shadow-sm">Preparando operación de delivery…</div> : null}

      {!loading && tab === 'operation' ? (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-black text-central-carbon">Pedidos sin asignar</h2><p className="text-xs text-neutral-500">Solo pedidos delivery abiertos.</p></div><span className="rounded-full bg-central-orange/10 px-3 py-1 text-xs font-black text-central-orange">{data.unassignedOrders.length}</span></div>
            <div className="space-y-3">
              {data.unassignedOrders.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">No hay pedidos esperando repartidor.</div> : data.unassignedOrders.map((order) => (
                <article key={order.id} className="rounded-sm border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-central-carbon">{order.orderCode} · {order.customerName}</p><p className="mt-1 text-xs text-neutral-500">{order.address || 'Dirección sin texto'} · {order.distanceKm?.toFixed(1) ?? '—'} km</p></div><div className="text-right"><p className="font-black">{formatCurrency(order.total)}</p><p className="text-xs text-neutral-500">Envío {formatCurrency(order.deliveryCost)}</p></div></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><select className={fieldClass} value={driverByOrder[order.id] ?? ''} onChange={(e) => setDriverByOrder((current) => ({ ...current, [order.id]: e.target.value }))}><option value="">Seleccionar repartidor</option>{activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName} · {driver.commissionPercent}%</option>)}</select><Button size="sm" onClick={() => void handleAssign(order.id, driverByOrder[order.id] ?? '')} disabled={busyId === order.id}>Asignar</Button></div>
                </article>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="font-black text-central-carbon">Repartos en curso</h2><p className="text-xs text-neutral-500">Pedido y logística tienen estados independientes; acá se controla la última milla.</p></div>
            <div className="space-y-3">
              {activeAssignments.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">No hay repartos activos.</div> : activeAssignments.map((item) => (
                <article key={item.id} className="rounded-sm border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-central-carbon">{item.orderCode} · {item.customerName}</p><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(item.status)}`}>{STATUS_LABELS[item.status]}</span></div><p className="mt-1 text-xs text-neutral-500">{item.driverName} · comisión {formatCurrency(item.commissionAmount)} ({item.commissionPercent}%)</p></div><div className="text-right"><p className="text-sm font-bold">{item.paymentMethod === 'efectivo' ? `Cobrar ${formatCurrency(item.cashToCollect)}` : 'Transferencia'}</p><p className="text-xs text-neutral-500">Asignado {formatDateTime(item.assignedAt)}</p></div></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><select className={fieldClass} value={driverByAssignment[item.id] ?? item.driverId} onChange={(e) => setDriverByAssignment((current) => ({ ...current, [item.id]: e.target.value }))}>{activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}</select><Button size="sm" variant="secondary" onClick={() => void handleAssign(item.orderId, driverByAssignment[item.id] ?? item.driverId, item.id)} disabled={busyId === item.id}><RotateCcw size={14} /> Reasignar</Button><Button size="sm" variant="danger" onClick={() => void handleCancelAssignment(item)} disabled={busyId === item.id}>Quitar</Button></div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!loading && tab === 'drivers' ? (
        <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-central-carbon">Equipo de reparto</h2><p className="text-xs text-neutral-500">La comisión vigente se versiona; las entregas conservan el porcentaje histórico asignado.</p></div><Button onClick={() => setDriverModal('new')}><UserPlus size={16} /> Alta</Button></div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.drivers.map((driver) => (
              <article key={driver.id} className={`rounded-sm border p-4 ${driver.active ? 'border-neutral-200' : 'border-neutral-200 bg-neutral-50 opacity-75'}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-central-orange/10 text-central-orange"><Bike size={17} /></span><div><p className="font-black text-central-carbon">{driver.fullName}</p><p className="text-xs text-neutral-500">{driver.email || 'Sin email'}</p></div></div></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${driver.active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>{driver.active ? 'Activo' : 'Inactivo'}</span></div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-sm bg-neutral-50 p-3 text-center"><div><p className="text-[11px] text-neutral-500">Comisión</p><p className="mt-1 text-sm font-black">{driver.commissionPercent ?? 0}%</p></div><div><p className="text-[11px] text-neutral-500">Activos</p><p className="mt-1 text-sm font-black">{driver.activeAssignments}</p></div><div><p className="text-[11px] text-neutral-500">Pendiente</p><p className="mt-1 text-sm font-black">{formatCurrency(driver.pendingCommission)}</p></div></div>
                <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setDriverModal(driver)}><Edit3 size={14} /> Editar</Button><Button size="sm" variant="secondary" onClick={() => void handleResetPassword(driver)} disabled={busyId === driver.id}><ShieldCheck size={14} /> Clave</Button><Button size="sm" variant={driver.active ? 'danger' : 'dark'} onClick={() => void handleToggleDriver(driver)} disabled={busyId === driver.id}>{driver.active ? 'Desactivar' : 'Activar'}</Button></div>
              </article>
            ))}
            {data.drivers.length === 0 ? <div className="md:col-span-2 2xl:col-span-3 rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">Todavía no hay repartidores. Creá el primero para comenzar a asignar pedidos.</div> : null}
          </div>
        </section>
      ) : null}

      {!loading && tab === 'settlements' ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-5"><h2 className="font-black text-central-carbon">Nueva liquidación</h2><p className="text-xs text-neutral-500">Consolida solo entregas finalizadas todavía no incluidas en otra liquidación.</p></div>
            <div className="space-y-4"><label><span className={labelClass}>Repartidor</span><select className={fieldClass} value={settlementDriver} onChange={(e) => setSettlementDriver(e.target.value)}><option value="">Seleccionar</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}</select></label><label><span className={labelClass}>Desde</span><input type="date" className={fieldClass} value={settlementFrom} onChange={(e) => setSettlementFrom(e.target.value)} /></label><label><span className={labelClass}>Hasta</span><input type="date" className={fieldClass} value={settlementTo} onChange={(e) => setSettlementTo(e.target.value)} /></label><Button className="w-full" onClick={() => void handleCreateSettlement()} disabled={busyId === 'settlement-create'}><WalletCards size={16} /> Generar borrador</Button></div>
            <div className="mt-5 rounded-sm border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-700"><strong>Cómo se lee el saldo:</strong> comisión menos efectivo cobrado. Un saldo negativo indica efectivo que el repartidor debe rendir al negocio; uno positivo, importe a favor del repartidor.</div>
          </section>

          <section className="min-w-0 rounded-sm border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="font-black text-central-carbon">Historial de liquidaciones</h2><p className="text-xs text-neutral-500">Borradores, cierres pagados y conciliación de efectivo.</p></div>
            <div className="space-y-3">
              {data.settlements.map((item) => <article key={item.id} className="rounded-sm border border-neutral-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-central-carbon">{item.driverName}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : item.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{item.status === 'paid' ? 'Pagada' : item.status === 'cancelled' ? 'Cancelada' : 'Borrador'}</span></div><p className="mt-1 text-xs text-neutral-500">{new Date(item.periodFrom).toLocaleDateString('es-AR')} — {new Date(item.periodTo).toLocaleDateString('es-AR')} · {item.deliveries} entregas</p></div><div className="text-right"><p className="font-black">{formatCurrency(item.commissionTotal)} comisión</p><p className="text-xs text-neutral-500">Efectivo {formatCurrency(item.cashCollected)}</p></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-neutral-50 px-3 py-2"><p className="text-sm font-bold">Saldo neto: <span className={item.netBalance < 0 ? 'text-red-600' : 'text-emerald-700'}>{formatCurrency(item.netBalance)}</span></p>{item.status === 'draft' ? <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void handleSettlementAction(item.id, 'cancel')} disabled={busyId === item.id}>Cancelar</Button><Button size="sm" onClick={() => void handleSettlementAction(item.id, 'pay')} disabled={busyId === item.id}><CheckCircle2 size={14} /> Confirmar pago</Button></div> : <span className="text-xs text-neutral-500">{item.paidAt ? `Cerrada ${formatDateTime(item.paidAt)}` : 'Sin movimiento pendiente'}</span>}</div></article>)}
              {data.settlements.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">Todavía no se generaron liquidaciones.</div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {driverModal ? <DriverModal driver={driverModal === 'new' ? undefined : driverModal} onClose={() => setDriverModal(null)} onSaved={() => void load(true)} /> : null}
    </div>
  );
}
