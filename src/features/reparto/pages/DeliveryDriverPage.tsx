'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  ReceiptText,
  RefreshCw,
  Route,
  ShieldCheck,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { ROUTES } from '@/shared/constants/routes';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import {
  advanceDeliveryAssignment,
  getDeliveryDriverDashboard,
  getDeliveryDriverDeliveryDetail,
  isDeliveryDriverLoggedIn,
  logoutDeliveryDriver,
  rejectDeliveryAssignment,
  subscribeToDriverDeliveries,
} from '../services/delivery-driver.service';
import type {
  DeliveryAssignmentStatus,
  DeliveryDriverAssignment,
  DeliveryDriverDashboard,
  DeliveryDriverDeliveryDetail,
} from '../types/delivery-management.types';

const IOS_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';

const NEXT_STATUS: Partial<Record<DeliveryAssignmentStatus, { next: DeliveryAssignmentStatus; label: string }>> = {
  assigned: { next: 'accepted', label: 'Aceptar pedido' },
  accepted: { next: 'picked_up', label: 'Confirmar retiro' },
  picked_up: { next: 'in_transit', label: 'Iniciar viaje' },
  in_transit: { next: 'delivered', label: 'Marcar entregado' },
};

const STATUS_LABELS: Record<DeliveryAssignmentStatus, string> = {
  assigned: 'Asignado',
  accepted: 'Aceptado',
  picked_up: 'Retirado',
  in_transit: 'En camino',
  rejected_by_customer: 'Rechazado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_META: Record<DeliveryAssignmentStatus, { accent: string; soft: string }> = {
  assigned: { accent: '#007AFF', soft: '#EAF3FF' },
  accepted: { accent: '#5856D6', soft: '#EFEEFF' },
  picked_up: { accent: '#FF9500', soft: '#FFF4E5' },
  in_transit: { accent: '#30B0C7', soft: '#E8F8FB' },
  delivered: { accent: '#34C759', soft: '#EAF8EE' },
  rejected_by_customer: { accent: '#FF3B30', soft: '#FFF0EF' },
  cancelled: { accent: '#8E8E93', soft: '#F2F2F7' },
};

const DELIVERY_STEPS: Array<{ status: DeliveryAssignmentStatus; label: string }> = [
  { status: 'assigned', label: 'Asignado' },
  { status: 'accepted', label: 'Aceptado' },
  { status: 'picked_up', label: 'Retirado' },
  { status: 'in_transit', label: 'En camino' },
  { status: 'delivered', label: 'Entregado' },
];

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
    <article className="rounded-[22px] border border-black/[0.045] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.025)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[#8E8E93]">{label}</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.035em] text-[#1C1C1E]">{value}</p>
          <p className="mt-1 text-[12px] leading-4 text-[#8E8E93]">{helper}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F2F2F7] text-[#FF9500]">
          <Icon size={16} />
        </span>
      </div>
    </article>
  );
}

function DeliveryProgress({ status }: { status: DeliveryAssignmentStatus }) {
  const currentIndex = DELIVERY_STEPS.findIndex((step) => step.status === status);
  const meta = STATUS_META[status];

  return (
    <div className="rounded-[18px] bg-[#F2F2F7] px-3 py-3.5">
      <div className="flex items-start">
        {DELIVERY_STEPS.map((step, index) => {
          const done = currentIndex >= 0 && index <= currentIndex;
          const current = index === currentIndex;
          return (
            <div key={step.status} className="relative flex min-w-0 flex-1 flex-col items-center">
              {index > 0 ? (
                <span
                  className="absolute right-1/2 top-[5px] h-[2px] w-full -translate-y-1/2"
                  style={{ backgroundColor: done ? meta.accent : '#D1D1D6' }}
                />
              ) : null}
              <span
                className="relative z-10 grid h-[11px] w-[11px] place-items-center rounded-full border-2"
                style={{
                  borderColor: done ? meta.accent : '#C7C7CC',
                  backgroundColor: current ? meta.accent : done ? '#FFFFFF' : '#F2F2F7',
                }}
              >
                {done && !current ? <span className="h-[3px] w-[3px] rounded-full" style={{ backgroundColor: meta.accent }} /> : null}
              </span>
              <span
                className="mt-2 max-w-[64px] text-center text-[9px] leading-3"
                style={{ color: current ? meta.accent : done ? '#636366' : '#AEAEB2', fontWeight: current ? 600 : 400 }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
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
  const meta = STATUS_META[item.status];

  return (
    <article className="overflow-hidden rounded-[26px] border border-black/[0.05] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025),0_14px_40px_rgba(0,0,0,0.035)]">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#8E8E93]">{item.orderCode}</p>
            <h2 className="mt-1 truncate text-[20px] font-semibold tracking-[-0.025em] text-[#1C1C1E]">{item.customerName}</h2>
            <p className="mt-1 text-[12px] text-[#8E8E93]">Asignado {formatDateTime(item.assignedAt)}</p>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium"
            style={{ color: meta.accent, backgroundColor: meta.soft }}
          >
            {STATUS_LABELS[item.status]}
          </span>
        </div>
      </div>

      <div className="h-px bg-[#E5E5EA]" />

      <div className="space-y-4 p-5">
        <DeliveryProgress status={item.status} />

        <div className="rounded-[18px] bg-[#F2F2F7] px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#007AFF] shadow-sm">
              <MapPin size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[#8E8E93]">Destino</p>
              <p className="mt-0.5 break-words text-[14px] font-medium leading-5 text-[#1C1C1E]">{item.address || 'Ubicación enviada por GPS'}</p>
              <p className="mt-1 text-[12px] text-[#8E8E93]">{item.distanceKm?.toFixed(1) ?? '—'} km desde el local</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] bg-[#F2F2F7]">
          <div className="grid grid-cols-2 divide-x divide-[#D1D1D6]">
            <div className="p-3.5">
              <p className="text-[11px] text-[#8E8E93]">Cobro al cliente</p>
              <p className="mt-1 text-[14px] font-semibold text-[#1C1C1E]">
                {item.paymentMethod === 'efectivo' ? formatCurrency(item.cashToCollect) : 'Transferencia'}
              </p>
            </div>
            <div className="p-3.5">
              <p className="text-[11px] text-[#8E8E93]">Tu comisión · {item.commissionPercent}%</p>
              <p className="mt-1 text-[14px] font-semibold text-[#34C759]">{formatCurrency(item.commissionAmount)}</p>
            </div>
          </div>
        </div>

        {item.notes ? (
          <div className="rounded-[18px] bg-[#FFF7E8] px-4 py-3 text-[12px] leading-5 text-[#8A5A00]">
            <span className="font-medium">Observación:</span> {item.notes}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          <a
            href={`tel:${item.customerPhone}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#F2F2F7] text-[14px] font-medium text-[#007AFF] transition active:scale-[0.98]"
          >
            <Phone size={15} /> Llamar
          </a>
          {item.mapsUrl ? (
            <a
              href={item.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#F2F2F7] text-[14px] font-medium text-[#007AFF] transition active:scale-[0.98]"
            >
              <Navigation size={15} /> Navegar
            </a>
          ) : (
            <span className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#F2F2F7] text-[14px] text-[#AEAEB2]">
              <Navigation size={15} /> Sin mapa
            </span>
          )}
        </div>

        {transition ? (
          <button
            type="button"
            onClick={() => onAdvance(item)}
            disabled={busy}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[15px] text-[15px] font-semibold text-white shadow-sm transition duration-200 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: meta.accent }}
          >
            {busy ? 'Actualizando…' : <>{transition.label}<ChevronRight size={17} /></>}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onReject(item)}
          disabled={busy}
          className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] text-[12px] font-medium text-[#FF3B30] transition active:bg-[#FFF0EF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle size={15} /> Cliente rechazó el pedido
        </button>
      </div>
    </article>
  );
}

function Sheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full max-w-xl overflow-hidden rounded-t-[30px] bg-[#F2F2F7] shadow-2xl sm:rounded-[30px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-2.5 sm:hidden"><span className="h-1.5 w-10 rounded-full bg-[#C7C7CC]" /></div>
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0"><p className="truncate text-[17px] font-semibold tracking-[-0.015em] text-[#1C1C1E]">{title}</p></div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-[#E5E5EA] text-[#636366] transition active:scale-95" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[calc(92dvh-62px)] overflow-y-auto px-4 pb-6 sm:px-5">{children}</div>
      </section>
    </div>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#E5E5EA] px-4 py-3.5 last:border-b-0">
      <span className="text-[13px] text-[#8E8E93]">{label}</span>
      <span className="text-right text-[14px] font-medium text-[#1C1C1E]" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function DeliveryDetailSheet({ detail, loading, open, onClose }: { detail: DeliveryDriverDeliveryDetail | null; loading: boolean; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Detalle de entrega">
      {loading || !detail ? (
        <div className="grid min-h-72 place-items-center rounded-[22px] bg-white">
          <div className="text-center"><RefreshCw size={20} className="mx-auto animate-spin text-[#8E8E93]" /><p className="mt-3 text-[13px] text-[#8E8E93]">Cargando entrega…</p></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-[#8E8E93]">{detail.orderCode}</p>
                <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#1C1C1E]">{detail.customerName}</h3>
                <p className="mt-1 text-[13px] text-[#8E8E93]">Entregado {formatDateTime(detail.deliveredAt)}</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EAF8EE] text-[#34C759]"><Check size={18} /></span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <a href={`tel:${detail.customerPhone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-[#F2F2F7] text-[13px] font-medium text-[#007AFF]"><Phone size={14} /> Llamar</a>
              {detail.mapsUrl ? <a href={detail.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-[#F2F2F7] text-[13px] font-medium text-[#007AFF]"><Navigation size={14} /> Ubicación</a> : <span className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-[#F2F2F7] text-[13px] text-[#AEAEB2]"><Navigation size={14} /> Sin mapa</span>}
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
            <div className="px-4 pb-2 pt-4"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E8E93]">Destino</p></div>
            <DetailRow label="Dirección" value={detail.address || 'Ubicación enviada por GPS'} />
            <DetailRow label="Distancia" value={`${detail.distanceKm?.toFixed(1) ?? '—'} km`} />
          </div>

          <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
            <div className="px-4 pb-2 pt-4"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E8E93]">Importes</p></div>
            <DetailRow label="Subtotal" value={formatCurrency(detail.subtotal)} />
            <DetailRow label="Envío" value={formatCurrency(detail.deliveryFee)} />
            <DetailRow label="Total del pedido" value={formatCurrency(detail.orderTotal)} />
            <DetailRow label="Forma de pago" value={detail.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'} />
            {detail.paymentMethod === 'efectivo' ? <DetailRow label="Efectivo cobrado" value={formatCurrency(detail.cashToCollect)} /> : null}
            <DetailRow label={`Tu comisión · ${detail.commissionPercent}%`} value={`+${formatCurrency(detail.commissionAmount)}`} accent="#34C759" />
          </div>

          <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
            <div className="px-4 pb-2 pt-4"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E8E93]">Recorrido del pedido</p></div>
            <DetailRow label="Asignado" value={formatDateTime(detail.assignedAt)} />
            {detail.acceptedAt ? <DetailRow label="Aceptado" value={formatDateTime(detail.acceptedAt)} /> : null}
            {detail.pickedUpAt ? <DetailRow label="Retirado" value={formatDateTime(detail.pickedUpAt)} /> : null}
            {detail.inTransitAt ? <DetailRow label="En camino" value={formatDateTime(detail.inTransitAt)} /> : null}
            <DetailRow label="Entregado" value={formatDateTime(detail.deliveredAt)} accent="#34C759" />
          </div>

          {detail.notes ? (
            <div className="rounded-[22px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E8E93]">Observaciones</p>
              <p className="mt-2 text-[13px] leading-5 text-[#3A3A3C]">{detail.notes}</p>
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deliveryDetail, setDeliveryDetail] = useState<DeliveryDriverDeliveryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const knownAssignmentIds = useRef<Set<string>>(new Set());

  const load = useCallback(async (background = false, fromRealtime = false) => {
    background ? setRefreshing(true) : setLoading(true);
    try {
      const next = await getDeliveryDriverDashboard();
      const nextIds = new Set(next.activeAssignments.map((item) => item.id));
      const newAssignments = next.activeAssignments.filter((item) => !knownAssignmentIds.current.has(item.id));

      if (fromRealtime && knownAssignmentIds.current.size > 0 && newAssignments.length > 0) {
        toast.success(`Nuevo pedido asignado: ${newAssignments[0].orderCode}`);
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
      toast.success(transition.next === 'delivered' ? 'Entrega confirmada.' : `Pedido actualizado: ${STATUS_LABELS[transition.next]}.`);
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

  async function openDeliveryDetail(assignmentId: string) {
    setDetailId(assignmentId);
    setDeliveryDetail(null);
    setDetailLoading(true);
    try {
      setDeliveryDetail(await getDeliveryDriverDeliveryDetail(assignmentId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el detalle de la entrega.');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function logout() {
    await logoutDeliveryDriver();
    router.replace(ROUTES.deliveryLogin);
  }

  const recent = useMemo(() => data?.recentDeliveries ?? [], [data]);

  if (loading || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F2F2F7] px-4" style={{ fontFamily: IOS_FONT }}>
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-[16px] bg-white text-[#FF9500] shadow-sm"><Bike size={21} /></span>
          <p className="mt-4 text-[14px] text-[#8E8E93]">Preparando tu panel…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F7] pb-20 text-[#1C1C1E]" style={{ fontFamily: IOS_FONT }}>
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#F2F2F7]/88 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-white text-[#FF9500] shadow-sm"><Bike size={18} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" /><p className="text-[10px] font-medium text-[#8E8E93]">En línea · Actualización en vivo</p></div>
              <p className="mt-0.5 truncate text-[16px] font-semibold tracking-[-0.015em]">{data.driver.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void load(true)} className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white text-[#636366] shadow-sm transition active:scale-95" aria-label="Actualizar">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => void logout()} className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white text-[#636366] shadow-sm transition active:scale-95" aria-label="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-5">
          <p className="text-[13px] text-[#8E8E93]">Resumen</p>
          <h1 className="mt-0.5 text-[28px] font-semibold tracking-[-0.045em] text-[#1C1C1E]">Tus entregas</h1>
          <p className="mt-1 max-w-xl text-[14px] leading-5 text-[#8E8E93]">Los pedidos asignados aparecen automáticamente y cambian de estado en tiempo real.</p>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={Route} label="Activos" value={String(data.summary.activeAssignments)} helper="Pedidos en curso" />
          <SummaryCard icon={CircleDollarSign} label="Hoy" value={formatCurrency(data.summary.todayCommission)} helper="Comisión ganada" />
          <SummaryCard icon={WalletCards} label="Este mes" value={formatCurrency(data.summary.monthCommission)} helper="Comisión acumulada" />
          <SummaryCard icon={Banknote} label="Efectivo" value={formatCurrency(data.summary.cashPending)} helper="Pendiente de rendir" />
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div><p className="text-[13px] text-[#8E8E93]">Operación</p><h2 className="mt-0.5 text-[21px] font-semibold tracking-[-0.025em]">En curso</h2></div>
            <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#636366] shadow-sm">{data.activeAssignments.length}</span>
          </div>

          <div className="space-y-4">
            {data.activeAssignments.map((item) => (
              <AssignmentCard key={item.id} item={item} busy={busyId === item.id} onAdvance={(assignment) => void handleAdvance(assignment)} onReject={setRejectingItem} />
            ))}

            {data.activeAssignments.length === 0 ? (
              <div className="rounded-[26px] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAF8EE] text-[#34C759]"><CheckCircle2 size={21} /></span>
                <p className="mt-4 text-[17px] font-semibold tracking-[-0.015em]">Todo al día</p>
                <p className="mx-auto mt-1 max-w-xs text-[13px] leading-5 text-[#8E8E93]">No tenés entregas pendientes. El próximo pedido aparecerá acá apenas te lo asignen.</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025),0_12px_34px_rgba(0,0,0,0.025)]">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div><p className="text-[12px] text-[#8E8E93]">Historial</p><h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.02em]">Pedidos entregados</h2></div>
              <ReceiptText size={18} className="text-[#AEAEB2]" />
            </div>
            <div className="border-t border-[#E5E5EA]">
              {recent.map((item) => (
                <button key={item.id} type="button" onClick={() => void openDeliveryDetail(item.id)} className="flex w-full cursor-pointer items-center gap-3 border-b border-[#E5E5EA] px-5 py-3.5 text-left transition last:border-b-0 active:bg-[#F2F2F7]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF8EE] text-[#34C759]"><Check size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-[#1C1C1E]">{item.orderCode} · {item.customerName}</span><span className="mt-0.5 block text-[11px] text-[#8E8E93]">{formatDateTime(item.deliveredAt)}</span></span>
                  <span className="text-right"><span className="block text-[13px] font-semibold text-[#34C759]">+{formatCurrency(item.commissionAmount)}</span><span className="mt-0.5 block text-[10px] text-[#AEAEB2]">Ver detalle</span></span>
                  <ChevronRight size={15} className="shrink-0 text-[#C7C7CC]" />
                </button>
              ))}
              {recent.length === 0 ? <p className="px-5 py-9 text-center text-[13px] text-[#8E8E93]">Todavía no hay entregas finalizadas.</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025),0_12px_34px_rgba(0,0,0,0.025)]">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div><p className="text-[12px] text-[#8E8E93]">Liquidaciones</p><h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.02em]">Estado de pagos</h2></div>
              <ShieldCheck size={18} className="text-[#AEAEB2]" />
            </div>
            <div className="border-t border-[#E5E5EA]">
              {data.settlements.slice(0, 6).map((item) => (
                <div key={item.id} className="border-b border-[#E5E5EA] px-5 py-3.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-[14px] font-medium">{item.deliveries} entregas</p><p className="mt-0.5 text-[11px] text-[#8E8E93]">{new Date(item.periodFrom).toLocaleDateString('es-AR')} — {new Date(item.periodTo).toLocaleDateString('es-AR')}</p></div>
                    <span className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color: item.status === 'paid' ? '#248A3D' : item.status === 'cancelled' ? '#D70015' : '#9A6700', backgroundColor: item.status === 'paid' ? '#EAF8EE' : item.status === 'cancelled' ? '#FFF0EF' : '#FFF7E8' }}>{item.status === 'paid' ? 'Pagada' : item.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px]"><span className="text-[#8E8E93]">Comisión</span><span className="font-medium">{formatCurrency(item.commissionTotal)}</span></div>
                </div>
              ))}
              {data.settlements.length === 0 ? <p className="px-5 py-9 text-center text-[13px] text-[#8E8E93]">No hay liquidaciones generadas.</p> : null}
            </div>
          </section>
        </div>
      </div>

      <Sheet open={Boolean(rejectingItem)} onClose={() => { setRejectingItem(null); setRejectionReason(REJECTION_REASONS[0]); setRejectionDetail(''); }} title="Cliente rechazó el pedido">
        <div className="space-y-4">
          <div className="rounded-[20px] bg-[#FFF0EF] p-4 text-[12px] leading-5 text-[#D70015]">El pedido se cancelará y esta entrega no generará comisión. El motivo quedará guardado en el historial.</div>
          <div className="overflow-hidden rounded-[22px] bg-white">
            {REJECTION_REASONS.map((reason) => (
              <label key={reason} className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#E5E5EA] px-4 py-3.5 last:border-b-0">
                <span className="text-[14px] text-[#1C1C1E]">{reason}</span>
                <input type="radio" name="rejection-reason" checked={rejectionReason === reason} onChange={() => setRejectionReason(reason)} className="h-4 w-4 accent-[#007AFF]" />
              </label>
            ))}
          </div>
          <label className="block rounded-[22px] bg-white p-4">
            <span className="mb-2 block text-[11px] text-[#8E8E93]">Detalle opcional</span>
            <textarea value={rejectionDetail} onChange={(event) => setRejectionDetail(event.target.value)} rows={3} maxLength={240} placeholder={rejectionReason === 'Otro motivo' ? 'Contanos qué ocurrió…' : 'Podés agregar un detalle…'} className="w-full resize-none bg-transparent text-[14px] leading-5 text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC]" />
          </label>
          <button type="button" onClick={() => void handleReject()} disabled={!rejectingItem || busyId === rejectingItem.id} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[15px] bg-[#FF3B30] text-[15px] font-semibold text-white transition active:scale-[0.985] disabled:opacity-50"><XCircle size={16} /> Confirmar rechazo</button>
        </div>
      </Sheet>

      <DeliveryDetailSheet detail={deliveryDetail} loading={detailLoading} open={Boolean(detailId)} onClose={() => { setDetailId(null); setDeliveryDetail(null); }} />
    </main>
  );
}
