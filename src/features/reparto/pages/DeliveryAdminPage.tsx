'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Bike,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  ExternalLink,
  Eye,
  History,
  MailCheck,
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
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { formatRouteDuration } from '@/features/delivery/utils/delivery.utils';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { DatePickerField } from '@/shared/components/ui/DatePickerField';
import { Modal } from '@/shared/components/ui/Modal';
import { PasswordInput } from '@/shared/components/ui/PasswordInput';
import { SearchableSelect } from '@/shared/components/ui/SearchableSelect';
import { Select } from '@/shared/components/ui/Select';
import { TablePagination } from '@/shared/components/ui/TablePagination';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import { DeliveryAdminSkeleton } from '../components/DeliveryAdminSkeleton';
import { DeliveryMetricCard } from '../components/DeliveryMetricCard';
import {
  assignDelivery,
  cancelDeliveryAssignment,
  cancelDeliverySettlement,
  createDeliverySettlement,
  getDeliveryAdminDashboard,
  getDeliveryHistoryPage,
  markDeliverySettlementPaid,
  resetDeliveryDriverPassword,
  saveDeliveryDriver,
  subscribeToDeliveryOrders,
  toggleDeliveryDriver,
} from '../services/delivery-admin.service';
import type {
  DeliveryAdminDashboard,
  DeliveryAssignment,
  DeliveryAssignmentStatus,
  DeliveryDriver,
  DeliveryHistoryItem,
  DeliveryVehicleType,
  DriverFormPayload,
} from '../types/delivery-management.types';

type Tab = 'operation' | 'history' | 'drivers' | 'settlements';
type UnassignedScope = 'today' | 'all';
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

const fieldClass = 'h-10 w-full rounded-[11px] border border-neutral-200/70 bg-[#f7f7f9] px-3 text-[13px] font-normal text-neutral-900 outline-none transition duration-200 focus:border-central-orange/40 focus:bg-white focus:ring-2 focus:ring-central-orange/10';
const labelClass = 'mb-1.5 block text-[11px] font-medium text-neutral-500';

const STATUS_LABELS: Record<DeliveryAssignmentStatus, string> = {
  assigned: 'Asignado',
  accepted: 'Aceptado',
  picked_up: 'Retirado',
  in_transit: 'En camino',
  rejected_by_customer: 'Rechazado por cliente',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const VEHICLE_OPTIONS = [
  { value: 'moto', label: 'Moto' },
  { value: 'auto', label: 'Auto' },
  { value: 'bici', label: 'Bicicleta' },
  { value: 'otro', label: 'Otro' },
] as const;

const UNASSIGNED_SCOPE_OPTIONS = [
  { value: 'today', label: 'Pendientes de hoy' },
  { value: 'all', label: 'Todos sin asignar' },
] as const;

function statusClass(status: DeliveryAssignmentStatus) {
  if (status === 'delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'cancelled' || status === 'rejected_by_customer') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'in_transit' || status === 'picked_up') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function optionalDate(value: string | null) {
  return value ? formatDateTime(value) : '—';
}

function settlementLabel(status: DeliveryHistoryItem['settlementStatus']) {
  if (status === 'paid') return 'Pagada';
  if (status === 'draft') return 'En borrador';
  if (status === 'cancelled') return 'Cancelada';
  return 'Sin liquidar';
}

function dateKey(value: string | Date, timeZone: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : '';
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function DriverModal({ driver, onClose, onSaved }: { driver?: DeliveryDriver; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<DriverFormPayload>({
    driverId: driver?.id,
    fullName: driver?.fullName ?? '',
    email: driver?.email ?? '',
    phone: driver?.phone ?? '',
    vehicleType: driver?.vehicleType ?? 'moto',
    commissionPercent: driver?.commissionPercent ?? 30,
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.commissionPercent < 0 || form.commissionPercent > 100) {
      toast.warning('La comisión debe estar entre 0% y 100%.');
      return;
    }

    setSaving(true);
    try {
      await saveDeliveryDriver(form);
      toast.success(driver ? 'Repartidor actualizado.' : 'Invitación enviada. El repartidor deberá verificar su email y crear su contraseña.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el repartidor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={driver ? 'Editar repartidor' : 'Invitar repartidor'} size="md" theme="light">
      <form onSubmit={submit}>
        <div className="mb-5 rounded-sm border border-central-orange/15 bg-central-orange/[.05] p-3 text-xs leading-5 text-neutral-600">
          {driver
            ? 'La cuenta de acceso, los datos operativos y la tarifa se gestionan por separado para conservar el historial de entregas y comisiones.'
            : 'Se enviará una invitación al email indicado. El repartidor verificará su correo y elegirá su propia contraseña antes de quedar disponible para recibir pedidos.'}
        </div>
        {!driver ? (
          <div className="mb-4 flex items-start gap-3 rounded-sm border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-700"><MailCheck size={17} className="mt-0.5 shrink-0" /><span>No necesitás comunicarle una contraseña temporal. La activación se completa desde el correo de invitación.</span></div>
        ) : null}
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
          <Button type="submit" disabled={saving}>{saving ? (driver ? 'Guardando…' : 'Enviando…') : driver ? 'Guardar cambios' : 'Enviar invitación'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeliveryWalletOverview({ cashPending, pendingCommission }: { cashPending: number; pendingCommission: number }) {
  return (
    <section aria-label="Resumen financiero de reparto" className="relative flex min-w-0 flex-col overflow-hidden rounded-[23px] bg-[#191b20] px-5 py-6 text-white shadow-soft sm:px-7 sm:py-7 lg:min-h-[235px]">
      <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-central-orange/10 blur-[55px]" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[.12em] text-white/45">Balance de reparto</p>
          <p className="mt-1 text-[12px] text-white/55">Efectivo a rendir al negocio</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.08] text-white/80">
          <CircleDollarSign size={20} strokeWidth={1.7} />
        </span>
      </div>
      <p className="relative mt-5 break-words text-[clamp(2.5rem,4vw,3.65rem)] font-semibold leading-none tracking-[-.055em] [font-variant-numeric:tabular-nums]">
        {formatCurrency(cashPending)}
      </p>
      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
        <span className="inline-flex items-center gap-2 text-[12px] text-white/60">
          <BadgeDollarSign size={15} className="text-central-orange" /> Comisiones pendientes
        </span>
        <span className="text-[19px] font-semibold tracking-[-.035em] text-[#c7f0d7] [font-variant-numeric:tabular-nums]">
          {formatCurrency(pendingCommission)}
        </span>
      </div>
    </section>
  );
}

export function DeliveryAdminPage() {
  const { config } = useBusinessConfig();
  const [data, setData] = useState<DeliveryAdminDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('operation');
  const [query, setQuery] = useState('');
  const [unassignedScope, setUnassignedScope] = useState<UnassignedScope>('today');
  const [driverModal, setDriverModal] = useState<DeliveryDriver | 'new' | null>(null);
  const [resetDriver, setResetDriver] = useState<DeliveryDriver | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [driverByOrder, setDriverByOrder] = useState<Record<string, string>>({});
  const [commissionByOrder, setCommissionByOrder] = useState<Record<string, number>>({});
  const [driverByAssignment, setDriverByAssignment] = useState<Record<string, string>>({});
  const [settlementDriver, setSettlementDriver] = useState('');
  const [settlementFrom, setSettlementFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [settlementTo, setSettlementTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [historyRows, setHistoryRows] = useState<DeliveryHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<DeliveryHistoryItem | null>(null);

  const activeDrivers = useMemo(() => data.drivers.filter((driver) => driver.active && driver.commissionPercent !== null), [data.drivers]);
  const activeAssignments = useMemo(() => data.assignments.filter((item) => ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(item.status)), [data.assignments]);
  const activeDriverOptions = useMemo(() => activeDrivers.map((driver) => ({ value: driver.id, label: `${driver.fullName} · ${driver.commissionPercent}%` })), [activeDrivers]);
  const allDriverOptions = useMemo(() => data.drivers.map((driver) => ({ value: driver.id, label: `${driver.fullName}${driver.active ? '' : ' · inactivo'}`, disabled: !driver.active })), [data.drivers]);

  const businessTimeZone = config?.timezone ?? 'America/Argentina/Buenos_Aires';
  const deliveryUnassignedOrders = useMemo(
    () => data.unassignedOrders.filter((order) => order.deliveryMethod === 'delivery'),
    [data.unassignedOrders],
  );
  const todayKey = dateKey(new Date(), businessTimeZone);
  const todayUnassignedOrders = useMemo(
    () => deliveryUnassignedOrders.filter((order) => dateKey(order.createdAt, businessTimeZone) === todayKey),
    [businessTimeZone, deliveryUnassignedOrders, todayKey],
  );
  const scopedOrders = unassignedScope === 'today' ? todayUnassignedOrders : deliveryUnassignedOrders;

  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const filteredOrders = useMemo(() => {
    if (!normalizedQuery) return scopedOrders;
    return scopedOrders.filter((order) => [order.orderCode, order.customerName, order.customerPhone, order.address ?? ''].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery)));
  }, [normalizedQuery, scopedOrders]);
  const filteredAssignments = useMemo(() => {
    if (!normalizedQuery) return activeAssignments;
    return activeAssignments.filter((item) => [item.orderCode, item.customerName, item.customerPhone, item.address ?? '', item.driverName].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery)));
  }, [activeAssignments, normalizedQuery]);
  const filteredDrivers = useMemo(() => {
    if (!normalizedQuery) return data.drivers;
    return data.drivers.filter((driver) => [driver.fullName, driver.email ?? '', driver.phone ?? ''].some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery)));
  }, [data.drivers, normalizedQuery]);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    try {
      setData(await getDeliveryAdminDashboard());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el módulo de delivery.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  const loadHistory = useCallback(async (targetPage: number, background = false) => {
    if (!background) setHistoryLoading(true);
    try {
      const result = await getDeliveryHistoryPage({ page: targetPage, pageSize: 10 });
      setHistoryRows(result.rows);
      setHistoryTotal(result.total);

      const maxPage = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (targetPage > maxPage) setHistoryPage(maxPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el historial de delivery.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    document.body.classList.add('delivery-wallet-active');
    return () => document.body.classList.remove('delivery-wallet-active');
  }, []);

  useEffect(() => {
    void load();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToDeliveryOrders(() => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(true), 150);
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    if (tab !== 'history') return;
    void loadHistory(historyPage);
  }, [historyPage, loadHistory, tab]);

  function handleOrderDriverChange(orderId: string, driverId: string) {
    setDriverByOrder((current) => ({ ...current, [orderId]: driverId }));
    const driver = activeDrivers.find((item) => item.id === driverId);
    if (driver?.commissionPercent !== null && driver?.commissionPercent !== undefined) {
      setCommissionByOrder((current) => ({ ...current, [orderId]: driver.commissionPercent as number }));
    }
  }

  async function handleAssign(orderId: string, driverId: string, commissionPercent?: number, assignmentId?: string) {
    if (!driverId) return toast.info('Seleccioná un repartidor.');
    const driver = activeDrivers.find((item) => item.id === driverId);
    const baseCommission = driver?.commissionPercent ?? null;
    const effectiveCommission = commissionPercent ?? baseCommission;

    if (!driver || effectiveCommission === null || effectiveCommission < 0 || effectiveCommission > 100) {
      return toast.warning('La comisión debe estar entre 0% y 100%.');
    }

    const override = baseCommission !== null && Math.abs(effectiveCommission - baseCommission) < 0.005
      ? null
      : effectiveCommission;

    const snapshot = data;
    const optimisticId = assignmentId ?? `optimistic:${orderId}`;

    setData((current) => {
      if (assignmentId) {
        const previousAssignment = current.assignments.find((item) => item.id === assignmentId);
        if (!previousAssignment) return current;

        const driverChanged = previousAssignment.driverId !== driverId;
        return {
          ...current,
          assignments: current.assignments.map((item) => item.id === assignmentId
            ? {
                ...item,
                driverId,
                driverName: driver.fullName,
                commissionPercent: effectiveCommission,
                commissionAmount: item.deliveryFee * effectiveCommission / 100,
              }
            : item),
          drivers: driverChanged
            ? current.drivers.map((item) => {
                if (item.id === previousAssignment.driverId) {
                  return { ...item, activeAssignments: Math.max(0, item.activeAssignments - 1) };
                }
                if (item.id === driverId) {
                  return { ...item, activeAssignments: item.activeAssignments + 1 };
                }
                return item;
              })
            : current.drivers,
        };
      }

      const order = current.unassignedOrders.find((item) => item.id === orderId);
      if (!order || order.deliveryMethod !== 'delivery') return current;

      const optimisticAssignment: DeliveryAssignment = {
        id: optimisticId,
        orderId: order.id,
        orderCode: order.orderCode,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: order.address,
        mapsUrl: order.mapsUrl,
        distanceKm: order.distanceKm,
        routeDistanceKm: order.routeDistanceKm,
        straightDistanceKm: order.straightDistanceKm,
        routeDurationSeconds: order.routeDurationSeconds,
        routeProvider: order.routeProvider,
        travelMode: order.travelMode,
        routeVia: order.routeVia,
        orderTotal: order.total,
        paymentMethod: order.paymentMethod,
        driverId,
        driverName: driver.fullName,
        status: 'assigned',
        deliveryFee: order.deliveryCost,
        commissionPercent: effectiveCommission,
        commissionAmount: order.deliveryCost * effectiveCommission / 100,
        cashToCollect: order.paymentMethod === 'efectivo' ? order.total : 0,
        assignedAt: new Date().toISOString(),
        acceptedAt: null,
        pickedUpAt: null,
        inTransitAt: null,
        deliveredAt: null,
      };

      return {
        ...current,
        unassignedOrders: current.unassignedOrders.filter((item) => item.id !== orderId),
        assignments: [optimisticAssignment, ...current.assignments],
        drivers: current.drivers.map((item) => item.id === driverId
          ? { ...item, activeAssignments: item.activeAssignments + 1 }
          : item),
        summary: {
          ...current.summary,
          unassignedOrders: Math.max(0, current.summary.unassignedOrders - 1),
          activeAssignments: current.summary.activeAssignments + 1,
        },
      };
    });

    setBusyId(assignmentId ?? orderId);

    try {
      const savedAssignmentId = await assignDelivery(
        orderId,
        driverId,
        override,
        assignmentId ? 'Reasignación desde panel de delivery' : undefined,
      );

      if (!savedAssignmentId) throw new Error('La base de datos no confirmó la asignación.');

      toast.success(assignmentId ? 'Pedido reasignado.' : 'Pedido asignado.');
      setDriverByOrder((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setCommissionByOrder((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });

      void load(true);
    } catch (error) {
      setData(snapshot);
      toast.error(error instanceof Error ? error.message : 'No se pudo asignar el pedido.');
      void load(true);
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
    { id: 'history', label: 'Historial', icon: History },
    { id: 'drivers', label: 'Repartidores', icon: Users },
    { id: 'settlements', label: 'Liquidaciones', icon: WalletCards },
  ];

  const emptyOrdersMessage = normalizedQuery
    ? 'No hay pedidos que coincidan con la búsqueda.'
    : unassignedScope === 'today'
      ? 'No hay pedidos delivery sin asignar para hoy.'
      : 'No hay pedidos delivery pendientes de asignación.';

  const confirmCopy = pendingConfirmation?.type === 'cancel-assignment'
    ? { title: 'Quitar asignación', description: `El pedido ${pendingConfirmation.assignment.orderCode} volverá a la cola sin asignar. El historial de la asignación anterior se conservará.`, label: 'Quitar asignación', tone: 'danger' as const }
    : pendingConfirmation?.type === 'toggle-driver'
      ? { title: pendingConfirmation.driver.active ? 'Desactivar repartidor' : 'Activar repartidor', description: `${pendingConfirmation.driver.fullName} ${pendingConfirmation.driver.active ? 'dejará de estar disponible para nuevas asignaciones' : 'volverá a estar disponible para nuevas asignaciones'}.`, label: pendingConfirmation.driver.active ? 'Desactivar' : 'Activar', tone: pendingConfirmation.driver.active ? 'danger' as const : 'default' as const }
      : pendingConfirmation?.type === 'pay-settlement'
        ? { title: 'Confirmar liquidación', description: 'La liquidación quedará cerrada como pagada y conciliada. Esta acción no modifica los pedidos históricos.', label: 'Confirmar pago', tone: 'default' as const }
        : { title: 'Cancelar liquidación', description: 'El borrador se cancelará y sus entregas volverán a quedar disponibles para una liquidación posterior.', label: 'Cancelar liquidación', tone: 'danger' as const };

  return (
    <div className="delivery-wallet min-w-0 pb-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">Repartos y movimientos</h1>
          <p className="mt-1 text-[13px] leading-5 text-neutral-500">Pedidos, equipo y saldos bajo control.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="!h-9 !rounded-[11px] !border-neutral-200 !px-3 !text-[12px] !font-medium !shadow-none"
            onClick={() => {
              void load(true);
              if (tab === 'history') void loadHistory(historyPage, true);
            }}
            disabled={refreshing || (tab === 'history' && historyLoading)}
          >
            <RefreshCw size={14} className={refreshing || (tab === 'history' && historyLoading) ? 'animate-spin' : ''} />
            Actualizar
          </Button>
          <Button size="sm" className="!h-9 !rounded-[11px] !px-3 !text-[12px] !font-semibold !shadow-none" onClick={() => setDriverModal('new')}>
            <UserPlus size={14} /> Nuevo repartidor
          </Button>
        </div>
      </div>

      {loading ? <DeliveryAdminSkeleton /> : (
        <>
          <DeliveryWalletOverview
            cashPending={data.summary.cashPending}
            pendingCommission={data.summary.pendingCommission}
          />

          <section aria-label="Estado operativo" className="mt-4 grid min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-soft sm:grid-cols-3">
            <DeliveryMetricCard
              icon={PackageCheck}
              label="Pendientes hoy"
              value={String(todayUnassignedOrders.length)}
              detail={data.summary.unassignedOrders > todayUnassignedOrders.length
                ? `${data.summary.unassignedOrders} pendientes en total`
                : 'Esperando repartidor'}
            />
            <DeliveryMetricCard icon={Truck} label="En camino y asignados" value={String(data.summary.activeAssignments)} detail="Repartos abiertos" />
            <DeliveryMetricCard icon={Users} label="Repartidores activos" value={String(data.summary.activeDrivers)} detail="Disponibles para recibir pedidos" />
          </section>

          <section aria-label="Navegación de delivery" className="mb-5 mt-8 flex min-w-0 flex-col justify-between gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[21px] font-semibold tracking-[-.035em] text-neutral-950">Actividad de delivery</h2>
              <p className="mt-0.5 text-[12px] text-neutral-500">Administrá pedidos y operaciones en un solo lugar.</p>
            </div>
            <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-[12px] bg-[#eaeaec] p-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tab === id}
                  onClick={() => { setTab(id); setQuery(''); }}
                  className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[12px] font-medium transition-all duration-200 ${tab === id ? 'bg-white text-neutral-950 shadow-[0_1px_4px_rgba(0,0,0,.1)]' : 'text-neutral-500 hover:text-neutral-900'}`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </section>

          {tab === 'operation' || tab === 'drivers' ? (
            <div className="mb-5 flex max-w-[450px] items-center gap-2 rounded-[12px] border border-neutral-200/80 bg-white px-3 transition-colors duration-200 focus-within:border-central-orange/40 focus-within:ring-2 focus-within:ring-central-orange/10">
              <Search size={16} className="shrink-0 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === 'operation' ? 'Buscar pedido, cliente, teléfono o dirección…' : 'Buscar repartidor, email o teléfono…'}
                className="h-9 min-w-0 flex-1 bg-transparent text-[12px] font-normal outline-none placeholder:text-neutral-400"
              />
            </div>
          ) : null}

          {tab === 'operation' ? (
            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)]">
              <section className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-central-carbon">Pedidos sin asignar</h2>
                    <p className="text-xs text-neutral-500">Por defecto se muestran solo los pedidos delivery de hoy.</p>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="w-40 sm:w-44">
                      <Select
                        variant="light"
                        value={unassignedScope}
                        options={UNASSIGNED_SCOPE_OPTIONS}
                        onValueChange={(value) => setUnassignedScope(value as UnassignedScope)}
                        aria-label="Período de pedidos sin asignar"
                        className="!h-9 !rounded-[10px] !border-neutral-200/70 !bg-[#f7f7f9] !text-[12px] !shadow-none"
                      />
                    </div>
                    <span className="rounded-full bg-central-orange/10 px-2.5 py-1 text-[11px] font-medium text-central-orange">{filteredOrders.length}</span>
                  </div>
                </div>
                <div className="custom-scrollbar max-h-[68vh] space-y-0 overflow-y-auto pr-1">
                  {filteredOrders.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">{emptyOrdersMessage}</div> : filteredOrders.map((order) => {
                    const selectedDriverId = driverByOrder[order.id] ?? '';
                    const selectedDriver = activeDrivers.find((driver) => driver.id === selectedDriverId);
                    const commissionPercent = commissionByOrder[order.id] ?? selectedDriver?.commissionPercent ?? 0;
                    const isCustomCommission = Boolean(selectedDriver && selectedDriver.commissionPercent !== null && Math.abs(commissionPercent - selectedDriver.commissionPercent) >= 0.005);
                    const commissionAmount = order.deliveryCost * commissionPercent / 100;

                    return (
                      <article key={order.id} className="border-b border-neutral-100 px-1 py-4 last:border-b-0 sm:px-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-central-carbon">{order.orderCode} · {order.customerName}</p>
                            <p className="mt-1 break-words text-xs leading-5 text-neutral-500">{order.address || 'Dirección sin texto'} · {order.distanceKm?.toFixed(1) ?? '—'} km</p>
                            {unassignedScope === 'all' ? <p className="mt-1 text-[11px] text-neutral-400">Creado {formatDateTime(order.createdAt)}</p> : null}
                          </div>
                          <div className="text-right"><p className="font-semibold">{formatCurrency(order.total)}</p><p className="text-xs text-neutral-500">Envío {formatCurrency(order.deliveryCost)}</p></div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
                          <SearchableSelect
                            value={selectedDriverId}
                            options={activeDriverOptions}
                            onValueChange={(value) => handleOrderDriverChange(order.id, value)}
                            placeholder="Seleccionar repartidor"
                            searchPlaceholder="Buscar repartidor…"
                            emptyMessage="No hay repartidores activos."
                            aria-label={`Repartidor para ${order.orderCode}`}
                            className="!rounded-[11px] !border-neutral-200/70 !bg-[#f7f7f9] !text-[12px] !shadow-none"
                          />
                          <label className="relative block">
                            <span className="sr-only">Comisión para este pedido</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              disabled={!selectedDriver}
                              value={selectedDriver ? commissionPercent : ''}
                              onChange={(event) => setCommissionByOrder((current) => ({ ...current, [order.id]: Number(event.target.value) }))}
                              className="h-10 w-full rounded-[11px] border border-neutral-200/80 bg-[#f7f7f9] px-3 pr-8 text-[12px] font-medium text-neutral-900 outline-none transition focus:border-central-orange/40 focus:ring-2 focus:ring-central-orange/10 disabled:bg-neutral-50 disabled:text-neutral-300"
                              placeholder="%"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">%</span>
                          </label>
                          <Button size="sm" onClick={() => void handleAssign(order.id, selectedDriverId, commissionPercent)} disabled={busyId === order.id || !selectedDriver}>Asignar</Button>
                        </div>

                        {selectedDriver ? (
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-[11px] bg-[#f7f7f8] px-3 py-2 text-[11px]">
                            <span className="text-neutral-500">
                              Base {selectedDriver.commissionPercent}% {isCustomCommission ? '· comisión personalizada' : '· comisión base'}
                            </span>
                            <span className="font-semibold text-emerald-700">Recibe {formatCurrency(commissionAmount)}</span>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-4"><h2 className="font-semibold text-central-carbon">Repartos en curso</h2><p className="text-xs text-neutral-500">Los estados logísticos se registran sin mezclar el historial comercial del pedido.</p></div>
                <div className="custom-scrollbar max-h-[68vh] space-y-0 overflow-y-auto pr-1">
                  {filteredAssignments.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">No hay repartos activos que coincidan con la búsqueda.</div> : filteredAssignments.map((item) => (
                    <article key={item.id} className="border-b border-neutral-100 px-1 py-4 last:border-b-0 sm:px-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="break-words font-semibold text-central-carbon">{item.orderCode} · {item.customerName}</p><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>{STATUS_LABELS[item.status]}</span></div>
                          <p className="mt-1 text-xs text-neutral-500">{item.driverName} · comisión {formatCurrency(item.commissionAmount)} ({item.commissionPercent}%)</p>
                        </div>
                        <div className="text-right"><p className="text-sm font-semibold">{item.paymentMethod === 'efectivo' ? `Cobrar ${formatCurrency(item.cashToCollect)}` : 'Transferencia'}</p><p className="text-xs text-neutral-500">Asignado {formatDateTime(item.assignedAt)}</p></div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <SearchableSelect
                          value={driverByAssignment[item.id] ?? item.driverId}
                          options={activeDriverOptions}
                          onValueChange={(value) => setDriverByAssignment((current) => ({ ...current, [item.id]: value }))}
                          searchPlaceholder="Buscar repartidor…"
                          aria-label={`Reasignar ${item.orderCode}`}
                          className="!rounded-[11px] !border-neutral-200/70 !bg-[#f7f7f9] !text-[12px] !shadow-none"
                        />
                        <Button size="sm" variant="secondary" onClick={() => void handleAssign(item.orderId, driverByAssignment[item.id] ?? item.driverId, undefined, item.id)} disabled={busyId === item.id}><RotateCcw size={14} /> Reasignar</Button>
                        <Button size="sm" variant="danger" onClick={() => setPendingConfirmation({ type: 'cancel-assignment', assignment: item })} disabled={busyId === item.id}>Quitar</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}


          {tab === 'history' ? (
            <section className="overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-soft">
              <div className="flex flex-col gap-2 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-central-carbon">Historial de repartos asignados</h2>
                  <p className="mt-1 text-xs text-neutral-500">Cada página consulta solo 10 asignaciones en la base de datos, ordenadas desde la más reciente.</p>
                </div>
                <span className="text-xs font-semibold text-neutral-500">{historyTotal} asignaciones registradas</span>
              </div>

              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-[12px]">
                  <thead className="border-b border-neutral-100 bg-[#f8f8f9] text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
                    <tr>
                      <th className="whitespace-nowrap px-5 py-3.5">Fecha</th>
                      <th className="px-4 py-3.5">Pedido / Cliente</th>
                      <th className="px-4 py-3.5">Repartidor</th>
                      <th className="px-4 py-3.5">Estado</th>
                      <th className="px-4 py-3.5 text-right">Importe</th>
                      <th className="px-4 py-3.5 text-right">Comisión</th>
                      <th className="px-5 py-3.5 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {historyLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td colSpan={7} className="px-5 py-4"><div className="h-5 animate-pulse rounded-lg bg-neutral-100" /></td>
                        </tr>
                      ))
                    ) : historyRows.length ? historyRows.map((item) => (
                      <tr key={item.id} className="transition-colors duration-200 hover:bg-[#fafafa]">
                        <td className="whitespace-nowrap px-5 py-4 text-neutral-500">{formatDateTime(item.assignedAt)}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-neutral-900">{item.orderCode}</p>
                          <p className="mt-0.5 max-w-[230px] truncate text-[11px] text-neutral-500" title={item.customerName}>{item.customerName}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-neutral-900">{item.driverName}</p>
                          <p className="mt-0.5 text-[11px] capitalize text-neutral-400">{item.vehicleType}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(item.status)}`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-neutral-900">{formatCurrency(item.orderTotal)}</td>
                        <td className="px-4 py-4 text-right">
                          <p className="whitespace-nowrap font-semibold text-emerald-700">{formatCurrency(item.commissionAmount)}</p>
                          <p className="mt-0.5 text-[11px] text-neutral-400">{settlementLabel(item.settlementStatus)}</p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setHistoryDetail(item)}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950"
                          >
                            <Eye size={13} /> Ver detalle
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="px-5 py-10 text-center text-[12px] text-neutral-500">Todavía no hay asignaciones de delivery registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <TablePagination
                page={historyPage}
                pageSize={10}
                totalItems={historyTotal}
                onPageChange={setHistoryPage}
              />
            </section>
          ) : null}

          {tab === 'drivers' ? (
            <section className="rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-central-carbon">Equipo de reparto</h2><p className="text-xs text-neutral-500">La tarifa vigente se versiona; cada asignación referencia la tarifa histórica que le corresponde.</p></div><Button onClick={() => setDriverModal('new')}><UserPlus size={16} /> Alta</Button></div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {filteredDrivers.map((driver) => (
                  <article key={driver.id} className={`rounded-[15px] border p-4 transition-colors duration-200 ${driver.active ? 'border-neutral-200/70 bg-[#fafafa]' : 'border-neutral-200/70 bg-neutral-50 opacity-75'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-central-orange/10 text-central-orange"><Bike size={17} /></span><div className="min-w-0"><p className="truncate font-semibold text-central-carbon">{driver.fullName}</p><p className="truncate text-xs text-neutral-500">{driver.email || 'Sin email'}</p></div></div></div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${driver.active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>{driver.active ? 'Activo' : 'Inactivo / pendiente'}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-[12px] bg-white p-3 text-center"><div><p className="text-[11px] text-neutral-500">Comisión</p><p className="mt-1 text-sm font-semibold">{driver.commissionPercent ?? 0}%</p></div><div><p className="text-[11px] text-neutral-500">Activos</p><p className="mt-1 text-sm font-semibold">{driver.activeAssignments}</p></div><div><p className="text-[11px] text-neutral-500">Pendiente</p><p className="mt-1 text-sm font-semibold">{formatCurrency(driver.pendingCommission)}</p></div></div>
                    <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setDriverModal(driver)}><Edit3 size={14} /> Editar</Button>{driver.active ? <Button size="sm" variant="secondary" onClick={() => { setResetDriver(driver); setNewPassword(''); }} disabled={busyId === driver.id}><ShieldCheck size={14} /> Clave</Button> : null}<Button size="sm" variant={driver.active ? 'danger' : 'dark'} onClick={() => setPendingConfirmation({ type: 'toggle-driver', driver })} disabled={busyId === driver.id}>{driver.active ? 'Desactivar' : 'Activar'}</Button></div>
                  </article>
                ))}
                {filteredDrivers.length === 0 ? <div className="md:col-span-2 2xl:col-span-3 rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">No hay repartidores que coincidan con la búsqueda.</div> : null}
              </div>
            </section>
          ) : null}

          {tab === 'settlements' ? (
            <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <section className="rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-5"><h2 className="font-semibold text-central-carbon">Nueva liquidación</h2><p className="text-xs text-neutral-500">Consolida únicamente entregas finalizadas todavía no incluidas en otra liquidación.</p></div>
                <div className="space-y-4">
                  <div><span className={labelClass}>Repartidor</span><SearchableSelect value={settlementDriver} options={allDriverOptions} onValueChange={setSettlementDriver} placeholder="Seleccionar repartidor" searchPlaceholder="Buscar repartidor…" className="!rounded-[11px] !border-neutral-200/70 !bg-[#f7f7f9] !text-[12px] !shadow-none" /></div>
                  <div>
                    <span className={labelClass}>Desde</span>
                    <DatePickerField value={settlementFrom} onChange={setSettlementFrom} ariaLabel="Fecha desde de la liquidación" className="!rounded-[11px] !border-neutral-200/70 !bg-[#f7f7f9] !text-[12px]" />
                  </div>
                  <div>
                    <span className={labelClass}>Hasta</span>
                    <DatePickerField value={settlementTo} onChange={setSettlementTo} ariaLabel="Fecha hasta de la liquidación" className="!rounded-[11px] !border-neutral-200/70 !bg-[#f7f7f9] !text-[12px]" />
                  </div>
                  <Button className="w-full" onClick={() => void handleCreateSettlement()} disabled={busyId === 'settlement-create'}><WalletCards size={16} /> Generar borrador</Button>
                </div>
                <div className="mt-5 rounded-sm border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-700"><strong>Saldo neto:</strong> comisión ganada menos efectivo cobrado. Un saldo negativo indica efectivo a rendir al negocio; uno positivo, importe a favor del repartidor.</div>
              </section>

              <section className="min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-4"><h2 className="font-semibold text-central-carbon">Historial de liquidaciones</h2><p className="text-xs text-neutral-500">Borradores, cierres pagados y conciliación de efectivo.</p></div>
                <div className="custom-scrollbar max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                  {data.settlements.map((item) => (
                    <article key={item.id} className="border-b border-neutral-100 px-1 py-4 last:border-b-0 sm:px-2">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-central-carbon">{item.driverName}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : item.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{item.status === 'paid' ? 'Pagada' : item.status === 'cancelled' ? 'Cancelada' : 'Borrador'}</span></div><p className="mt-1 text-xs text-neutral-500">{new Date(item.periodFrom).toLocaleDateString('es-AR')} — {new Date(item.periodTo).toLocaleDateString('es-AR')} · {item.deliveries} entregas</p></div><div className="text-right"><p className="font-semibold">{formatCurrency(item.commissionTotal)} comisión</p><p className="text-xs text-neutral-500">Efectivo {formatCurrency(item.cashCollected)}</p></div></div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[11px] bg-[#f7f7f8] px-3 py-2"><p className="text-sm font-semibold">Saldo neto: <span className={item.netBalance < 0 ? 'text-red-600' : 'text-emerald-700'}>{formatCurrency(item.netBalance)}</span></p>{item.status === 'draft' ? <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setPendingConfirmation({ type: 'cancel-settlement', id: item.id })} disabled={busyId === item.id}>Cancelar</Button><Button size="sm" onClick={() => setPendingConfirmation({ type: 'pay-settlement', id: item.id })} disabled={busyId === item.id}><CheckCircle2 size={14} /> Confirmar pago</Button></div> : <span className="text-xs text-neutral-500">{item.paidAt ? `Cerrada ${formatDateTime(item.paidAt)}` : 'Sin movimiento pendiente'}</span>}</div>
                    </article>
                  ))}
                  {data.settlements.length === 0 ? <div className="rounded-sm border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">Todavía no se generaron liquidaciones.</div> : null}
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}


      <Modal
        open={Boolean(historyDetail)}
        onClose={() => setHistoryDetail(null)}
        title={historyDetail ? `Detalle de reparto · ${historyDetail.orderCode}` : 'Detalle de reparto'}
        size="xl"
        theme="light"
      >
        {historyDetail ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-sm border border-neutral-200 bg-neutral-50/60 p-4 lg:col-span-2">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-central-orange">Pedido</p>
                    <h3 className="mt-1 text-lg font-semibold text-central-carbon">{historyDetail.orderCode} · {historyDetail.customerName}</h3>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(historyDetail.status)}`}>{STATUS_LABELS[historyDetail.status]}</span>
                </div>

                <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-neutral-400">Teléfono</p><p className="font-semibold text-central-carbon">{historyDetail.customerPhone}</p></div>
                  <div><p className="text-xs text-neutral-400">Estado comercial</p><p className="font-semibold capitalize text-central-carbon">{historyDetail.orderStatus.replaceAll('_', ' ')}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs text-neutral-400">Dirección</p><p className="font-semibold text-central-carbon">{historyDetail.address || 'Sin dirección textual'}</p></div>
                  <div><p className="text-xs text-neutral-400">Distancia por ruta</p><p className="font-semibold">{(historyDetail.routeDistanceKm ?? historyDetail.distanceKm) === null ? '—' : `${(historyDetail.routeDistanceKm ?? historyDetail.distanceKm)?.toFixed(2)} km`}</p></div>
                  <div><p className="text-xs text-neutral-400">Tiempo estimado</p><p className="font-semibold">{formatRouteDuration(historyDetail.routeDurationSeconds)}</p></div>
                  {historyDetail.routeVia ? <div><p className="text-xs text-neutral-400">Ruta sugerida</p><p className="font-semibold">{historyDetail.routeVia}</p></div> : null}
                  {historyDetail.routeProvider ? <div><p className="text-xs text-neutral-400">Fuente de cálculo</p><p className="font-semibold">{historyDetail.routeProvider === 'serpapi_google_maps' ? 'Google Maps · SerpApi' : historyDetail.routeProvider}</p></div> : null}
                  {historyDetail.travelMode ? <div><p className="text-xs text-neutral-400">Modo</p><p className="font-semibold">{historyDetail.travelMode === 'two_wheeler' ? 'Moto' : historyDetail.travelMode}</p></div> : null}
                  <div><p className="text-xs text-neutral-400">Método de pago</p><p className="font-semibold">{historyDetail.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}</p></div>
                  <div><p className="text-xs text-neutral-400">Subtotal</p><p className="font-semibold">{formatCurrency(historyDetail.subtotal)}</p></div>
                  <div><p className="text-xs text-neutral-400">Costo de envío</p><p className="font-semibold">{formatCurrency(historyDetail.deliveryFee)}</p></div>
                  <div><p className="text-xs text-neutral-400">Total del pedido</p><p className="font-semibold">{formatCurrency(historyDetail.orderTotal)}</p></div>
                  <div><p className="text-xs text-neutral-400">Efectivo a cobrar</p><p className="font-semibold">{formatCurrency(historyDetail.cashToCollect)}</p></div>
                </div>

                {historyDetail.mapsUrl ? (
                  <a href={historyDetail.mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-central-orange hover:underline">
                    <ExternalLink size={13} /> Abrir ubicación del cliente en Google Maps
                  </a>
                ) : null}
              </section>

              <section className="border-b border-neutral-100 px-1 py-4 last:border-b-0 sm:px-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-central-orange">Repartidor y comisión</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div><p className="text-xs text-neutral-400">Repartidor</p><p className="font-semibold text-central-carbon">{historyDetail.driverName}</p></div>
                  <div><p className="text-xs text-neutral-400">Vehículo</p><p className="font-semibold capitalize">{historyDetail.vehicleType}</p></div>
                  <div><p className="text-xs text-neutral-400">Comisión aplicada</p><p className="font-semibold text-emerald-700">{historyDetail.commissionPercent}% · {formatCurrency(historyDetail.commissionAmount)}</p></div>
                  <div><p className="text-xs text-neutral-400">Liquidación</p><p className="font-semibold">{settlementLabel(historyDetail.settlementStatus)}</p></div>
                  <div><p className="text-xs text-neutral-400">Fecha de pago</p><p className="font-semibold">{optionalDate(historyDetail.settlementPaidAt)}</p></div>
                </div>
              </section>
            </div>

            <section className="border-b border-neutral-100 px-1 py-4 last:border-b-0 sm:px-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-central-orange">Tiempos del reparto</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-neutral-400">Asignado</p><p className="font-semibold">{optionalDate(historyDetail.assignedAt)}</p></div>
                <div><p className="text-xs text-neutral-400">Aceptado</p><p className="font-semibold">{optionalDate(historyDetail.acceptedAt)}</p></div>
                <div><p className="text-xs text-neutral-400">Retirado</p><p className="font-semibold">{optionalDate(historyDetail.pickedUpAt)}</p></div>
                <div><p className="text-xs text-neutral-400">En camino</p><p className="font-semibold">{optionalDate(historyDetail.inTransitAt)}</p></div>
                <div><p className="text-xs text-neutral-400">Entregado</p><p className="font-semibold">{optionalDate(historyDetail.deliveredAt)}</p></div>
                <div><p className="text-xs text-neutral-400">Rechazado</p><p className="font-semibold">{optionalDate(historyDetail.rejectedAt)}</p></div>
                <div><p className="text-xs text-neutral-400">Cancelado</p><p className="font-semibold">{optionalDate(historyDetail.cancelledAt)}</p></div>
                <div><p className="text-xs text-neutral-400">Pedido creado</p><p className="font-semibold">{optionalDate(historyDetail.orderCreatedAt)}</p></div>
              </div>
              {historyDetail.rejectionReason ? <p className="mt-3 rounded-sm bg-red-50 p-3 text-xs text-red-700"><strong>Motivo de rechazo:</strong> {historyDetail.rejectionReason}</p> : null}
              {historyDetail.cancellationReason ? <p className="mt-3 rounded-sm bg-red-50 p-3 text-xs text-red-700"><strong>Motivo de cancelación:</strong> {historyDetail.cancellationReason}</p> : null}
            </section>

            <section className="border-b border-neutral-100 px-1 py-4 last:border-b-0 sm:px-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-central-orange">Cronología registrada</p>
              <div className="mt-3 space-y-2">
                {historyDetail.events.length ? historyDetail.events.map((event, index) => (
                  <div key={`${event.createdAt}-${index}`} className="flex flex-col gap-1 rounded-sm bg-neutral-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-central-carbon">{STATUS_LABELS[event.status]}</p>
                      {event.note ? <p className="mt-0.5 text-xs text-neutral-500">{event.note}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-neutral-400">{formatDateTime(event.createdAt)}</p>
                  </div>
                )) : <p className="text-sm text-neutral-500">No hay eventos adicionales registrados para esta asignación.</p>}
              </div>
            </section>
          </div>
        ) : null}
      </Modal>

      {driverModal ? <DriverModal driver={driverModal === 'new' ? undefined : driverModal} onClose={() => setDriverModal(null)} onSaved={() => void load(true)} /> : null}

      <Modal open={Boolean(resetDriver)} onClose={() => { setResetDriver(null); setNewPassword(''); }} title="Cambiar contraseña" size="sm" theme="light">
        <div>
          <p className="mb-4 text-sm leading-6 text-neutral-600">Definí una nueva contraseña para <strong>{resetDriver?.fullName}</strong>. El cambio se aplica inmediatamente al acceso del repartidor.</p>
          <label><span className={labelClass}>Nueva contraseña</span><PasswordInput variant="light" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoFocus autoComplete="new-password" /></label>
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
