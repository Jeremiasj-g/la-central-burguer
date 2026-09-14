'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Bike,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/ui/Modal';
import { ROUTES } from '@/shared/constants/routes';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import {
  advanceDeliveryAssignment,
  getDeliveryDriverDashboard,
  isDeliveryDriverLoggedIn,
  logoutDeliveryDriver,
  rejectDeliveryAssignment,
  subscribeToDriverDeliveries,
} from '../services/delivery-driver.service';
import type {
  DeliveryAssignmentStatus,
  DeliveryDriverAssignment,
  DeliveryDriverDashboard,
} from '../types/delivery-management.types';

const NEXT_STATUS: Partial<Record<DeliveryAssignmentStatus, { next: DeliveryAssignmentStatus; label: string }>> = {
  assigned: { next: 'accepted', label: 'Aceptar pedido' },
  accepted: { next: 'picked_up', label: 'Confirmar retiro' },
  picked_up: { next: 'in_transit', label: 'Iniciar viaje' },
  in_transit: { next: 'delivered', label: 'Marcar entregado' },
};

const STATUS_LABELS: Record<DeliveryAssignmentStatus, string> = {
  assigned: 'Nuevo pedido',
  accepted: 'Aceptado',
  picked_up: 'Retirado',
  in_transit: 'En camino',
  rejected_by_customer: 'Rechazado por cliente',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const REJECTION_REASONS = [
  'Demora en la entrega',
  'Cliente cambió de opinión',
  'Cliente no quiso recibir el pedido',
  'Inconveniente con el pedido',
  'Otro motivo',
] as const;

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(0,0,0,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{label}</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#171716]">{value}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{helper}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f8f1e7] text-central-orange">
          <Icon size={16} />
        </span>
      </div>
    </article>
  );
}

function AssignmentCard({
  item,
  busy,
  onAdvance,
  onReject,
}: {
  item: DeliveryDriverAssignment;
  busy: boolean;
  onAdvance: (item: DeliveryDriverAssignment) => void;
  onReject: (item: DeliveryDriverAssignment) => void;
}) {
  const transition = NEXT_STATUS[item.status];

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.04)]">
      <div className="border-b border-neutral-100 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-central-orange">{item.orderCode}</p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-[#171716]">{item.customerName}</h2>
            <p className="mt-1 text-xs text-neutral-400">Asignado {formatDateTime(item.assignedAt)}</p>
          </div>
          <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold text-neutral-600">
            {STATUS_LABELS[item.status]}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3 rounded-xl bg-[#f8f8f6] p-3.5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-neutral-600 shadow-sm">
            <MapPin size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Destino</p>
            <p className="mt-1 break-words text-sm font-medium leading-5 text-neutral-800">{item.address || 'Ubicación enviada por GPS'}</p>
            <p className="mt-1 text-xs text-neutral-500">{item.distanceKm?.toFixed(1) ?? '—'} km desde el local</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-neutral-100 bg-white p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Cobro al cliente</p>
            <p className="mt-1.5 text-sm font-semibold text-neutral-800">
              {item.paymentMethod === 'efectivo' ? formatCurrency(item.cashToCollect) : 'Transferencia'}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600/75">Tu comisión · {item.commissionPercent}%</p>
            <p className="mt-1.5 text-sm font-semibold text-emerald-700">{formatCurrency(item.commissionAmount)}</p>
          </div>
        </div>

        {item.notes ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-3 text-xs leading-5 text-amber-800">
            <span className="font-semibold">Observación:</span> {item.notes}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <a
            href={`tel:${item.customerPhone}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            <Phone size={15} /> Llamar
          </a>
          {item.mapsUrl ? (
            <a
              href={item.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <Navigation size={15} /> Navegar
            </a>
          ) : (
            <span className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 text-sm font-medium text-neutral-400">
              <Navigation size={15} /> Sin mapa
            </span>
          )}
        </div>

        {transition ? (
          <Button className="h-12 w-full rounded-xl font-semibold" onClick={() => onAdvance(item)} disabled={busy}>
            {busy ? 'Actualizando…' : <>{transition.label}<ChevronRight size={16} /></>}
          </Button>
        ) : null}

        <button
          type="button"
          onClick={() => onReject(item)}
          disabled={busy}
          className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle size={15} /> Cliente rechazó el pedido
        </button>
      </div>
    </article>
  );
}

export function DeliveryDriverPage() {
  const router = useRouter();
  const [data, setData] = useState<DeliveryDriverDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<DeliveryDriverAssignment | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);
  const [rejectionDetail, setRejectionDetail] = useState('');
  const knownAssignmentIds = useRef<Set<string>>(new Set());

  const load = useCallback(async (background = false, fromRealtime = false) => {
    background ? setRefreshing(true) : setLoading(true);
    try {
      const next = await getDeliveryDriverDashboard();
      const nextIds = new Set(next.activeAssignments.map((item) => item.id));
      const newAssignments = next.activeAssignments.filter((item) => !knownAssignmentIds.current.has(item.id));

      if (fromRealtime && knownAssignmentIds.current.size > 0 && newAssignments.length > 0) {
        const newest = newAssignments[0];
        toast.success(`Nuevo pedido asignado: ${newest.orderCode}`);
      }

      knownAssignmentIds.current = nextIds;
      setData(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe = () => undefined;

    async function initialize() {
      try {
        const logged = await isDeliveryDriverLoggedIn();
        if (!active) return;
        if (!logged) {
          router.replace(ROUTES.deliveryLogin);
          return;
        }

        await load();
        if (!active) return;

        unsubscribe = subscribeToDriverDeliveries(() => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => void load(true, true), 180);
        });
      } catch {
        if (active) router.replace(ROUTES.deliveryLogin);
      }
    }

    void initialize();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [load, router]);

  async function handleAdvance(item: DeliveryDriverAssignment) {
    const transition = NEXT_STATUS[item.status];
    if (!transition) return;
    if (transition.next === 'delivered' && !confirm(`¿Confirmás que entregaste el pedido ${item.orderCode}?`)) return;

    setBusyId(item.id);
    try {
      await advanceDeliveryAssignment(item.id, transition.next);
      toast.success(transition.next === 'delivered' ? 'Entrega confirmada.' : 'Estado actualizado.');
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la entrega.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejectingItem) return;
    const detail = rejectionDetail.trim();
    if (rejectionReason === 'Otro motivo' && !detail) {
      toast.info('Contanos brevemente el motivo del rechazo.');
      return;
    }

    const reason = detail && rejectionReason !== 'Otro motivo'
      ? `${rejectionReason}: ${detail}`
      : detail || rejectionReason;

    setBusyId(rejectingItem.id);
    try {
      await rejectDeliveryAssignment(rejectingItem.id, reason);
      toast.success('Pedido registrado como rechazado por el cliente.');
      setRejectingItem(null);
      setRejectionReason(REJECTION_REASONS[0]);
      setRejectionDetail('');
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el rechazo.');
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await logoutDeliveryDriver();
    router.replace(ROUTES.deliveryLogin);
  }

  const recent = useMemo(() => data?.recentDeliveries ?? [], [data]);

  if (loading || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f5f2] px-4">
        <div className="text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#171716] text-central-orange"><Bike size={20} /></span>
          <p className="mt-4 text-sm font-medium text-neutral-500">Preparando tu panel…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f2] pb-20 text-[#171716]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#111110] text-white shadow-[0_8px_30px_rgba(0,0,0,0.16)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">Delivery · En vivo</p>
            </div>
            <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.01em] text-white">{data.driver.fullName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load(true)}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Actualizar"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => void logout()}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
        <section className="mb-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">Resumen de hoy</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-[#171716]">Tu operación de reparto</h1>
          <p className="mt-1 text-sm text-neutral-500">Los pedidos nuevos aparecen automáticamente cuando administración te los asigna.</p>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={Route} label="Activos" value={String(data.summary.activeAssignments)} helper="Pedidos asignados" />
          <SummaryCard icon={CircleDollarSign} label="Hoy" value={formatCurrency(data.summary.todayCommission)} helper="Comisión ganada" />
          <SummaryCard icon={WalletCards} label="Este mes" value={formatCurrency(data.summary.monthCommission)} helper="Comisión acumulada" />
          <SummaryCard icon={Banknote} label="Efectivo" value={formatCurrency(data.summary.cashPending)} helper="Pendiente de rendir" />
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-central-orange">Operación</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">Entregas asignadas</h2>
            </div>
            <span className="rounded-full bg-[#171716] px-3 py-1.5 text-[11px] font-semibold text-white">{data.activeAssignments.length}</span>
          </div>

          <div className="space-y-4">
            {data.activeAssignments.map((item) => (
              <AssignmentCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onAdvance={(assignment) => void handleAdvance(assignment)}
                onReject={setRejectingItem}
              />
            ))}

            {data.activeAssignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 px-6 py-12 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} /></span>
                <p className="mt-4 text-base font-semibold text-neutral-800">Todo al día</p>
                <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-neutral-500">No tenés entregas pendientes. El próximo pedido asignado aparecerá acá en tiempo real.</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(0,0,0,0.035)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Ganancias</p><h2 className="mt-1 text-base font-semibold">Últimas entregas</h2></div>
              <Clock3 size={17} className="text-neutral-300" />
            </div>
            <div className="divide-y divide-neutral-100">
              {recent.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-neutral-800">{item.orderCode} · {item.customerName}</p><p className="mt-1 text-xs text-neutral-400">{formatDateTime(item.deliveredAt)}</p></div>
                  <div className="text-right"><p className="text-sm font-semibold text-emerald-700">+{formatCurrency(item.commissionAmount)}</p>{item.cashToCollect > 0 ? <p className="mt-1 text-[10px] text-neutral-400">Cobrado {formatCurrency(item.cashToCollect)}</p> : null}</div>
                </div>
              ))}
              {recent.length === 0 ? <p className="py-8 text-center text-sm text-neutral-400">Todavía no hay entregas finalizadas.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(0,0,0,0.035)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Liquidaciones</p><h2 className="mt-1 text-base font-semibold">Estado de pagos</h2></div>
              <ShieldCheck size={17} className="text-neutral-300" />
            </div>
            <div className="space-y-2.5">
              {data.settlements.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl bg-[#f8f8f6] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-medium text-neutral-800">{item.deliveries} entregas</p><p className="mt-1 text-xs text-neutral-400">{new Date(item.periodFrom).toLocaleDateString('es-AR')} — {new Date(item.periodTo).toLocaleDateString('es-AR')}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : item.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{item.status === 'paid' ? 'Pagada' : item.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs"><span className="text-neutral-400">Comisión</span><span className="font-semibold text-neutral-700">{formatCurrency(item.commissionTotal)}</span></div>
                </div>
              ))}
              {data.settlements.length === 0 ? <p className="py-7 text-center text-sm text-neutral-400">No hay liquidaciones generadas.</p> : null}
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={Boolean(rejectingItem)}
        onClose={() => { setRejectingItem(null); setRejectionReason(REJECTION_REASONS[0]); setRejectionDetail(''); }}
        title="Cliente rechazó el pedido"
        size="sm"
        theme="light"
      >
        <div>
          <div className="rounded-xl border border-red-100 bg-red-50/70 p-3.5 text-xs leading-5 text-red-700">
            El pedido se marcará como cancelado y esta entrega no generará comisión. El motivo quedará guardado en el historial.
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Motivo</p>
            {REJECTION_REASONS.map((reason) => (
              <label key={reason} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${rejectionReason === reason ? 'border-central-orange/40 bg-central-orange/[0.05] text-neutral-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
                <input type="radio" name="rejection-reason" checked={rejectionReason === reason} onChange={() => setRejectionReason(reason)} className="accent-central-orange" />
                <span className="font-medium">{reason}</span>
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Detalle opcional</span>
            <textarea
              value={rejectionDetail}
              onChange={(event) => setRejectionDetail(event.target.value)}
              rows={3}
              maxLength={240}
              placeholder={rejectionReason === 'Otro motivo' ? 'Contanos qué ocurrió…' : 'Podés agregar un detalle si hace falta…'}
              className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-300 focus:border-central-orange focus:ring-2 focus:ring-central-orange/10"
            />
          </label>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setRejectingItem(null)}>Volver</Button>
            <Button variant="danger" onClick={() => void handleReject()} disabled={!rejectingItem || busyId === rejectingItem.id}><XCircle size={15} /> Confirmar rechazo</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
