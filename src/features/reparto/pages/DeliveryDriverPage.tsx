'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Bike,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  LogOut,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  Route,
  WalletCards,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { ROUTES } from '@/shared/constants/routes';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';
import {
  advanceDeliveryAssignment,
  getDeliveryDriverDashboard,
  isDeliveryDriverLoggedIn,
  logoutDeliveryDriver,
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
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

function SummaryCard({ icon: Icon, label, value, helper }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; helper: string }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wide text-neutral-400">{label}</p><p className="mt-2 text-xl font-black text-central-carbon">{value}</p><p className="mt-1 text-xs text-neutral-500">{helper}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-central-orange/10 text-central-orange"><Icon size={16} /></span></div>
    </article>
  );
}

function AssignmentCard({ item, busy, onAdvance }: { item: DeliveryDriverAssignment; busy: boolean; onAdvance: (item: DeliveryDriverAssignment) => void }) {
  const transition = NEXT_STATUS[item.status];
  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wide text-central-orange">{item.orderCode}</p><h2 className="mt-1 text-lg font-black text-central-carbon">{item.customerName}</h2><p className="mt-1 text-xs text-neutral-500">Asignado {formatDateTime(item.assignedAt)}</p></div>
          <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-black text-neutral-700">{STATUS_LABELS[item.status]}</span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><MapPin size={15} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Destino</p><p className="mt-1 break-words text-sm font-bold text-central-carbon">{item.address || 'Ubicación enviada por GPS'}</p><p className="mt-1 text-xs text-neutral-500">{item.distanceKm?.toFixed(1) ?? '—'} km desde el local</p></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-neutral-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Cobro</p><p className="mt-1 text-sm font-black text-central-carbon">{item.paymentMethod === 'efectivo' ? formatCurrency(item.cashToCollect) : 'Transferencia'}</p></div><div className="rounded-xl bg-neutral-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Tu comisión</p><p className="mt-1 text-sm font-black text-emerald-700">{formatCurrency(item.commissionAmount)}</p></div></div>
        {item.notes ? <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong>Observación:</strong> {item.notes}</div> : null}

        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${item.customerPhone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-bold text-central-carbon transition hover:border-central-orange/40"><Phone size={15} /> Llamar</a>
          {item.mapsUrl ? <a href={item.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-bold text-central-carbon transition hover:border-central-orange/40"><Navigation size={15} /> Navegar</a> : <span className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 text-sm font-bold text-neutral-400"><Navigation size={15} /> Sin mapa</span>}
        </div>

        {transition ? <Button className="h-12 w-full rounded-xl" onClick={() => onAdvance(item)} disabled={busy}>{busy ? 'Actualizando…' : <>{transition.label}<ChevronRight size={16} /></>}</Button> : null}
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

  async function load(background = false) {
    background ? setRefreshing(true) : setLoading(true);
    try {
      setData(await getDeliveryDriverDashboard());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    isDeliveryDriverLoggedIn().then((logged) => {
      if (!active) return;
      if (!logged) {
        router.replace(ROUTES.deliveryLogin);
        return;
      }
      void load();
    }).catch(() => router.replace(ROUTES.deliveryLogin));
    return () => { active = false; };
  }, [router]);

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
    } finally { setBusyId(null); }
  }

  async function logout() {
    await logoutDeliveryDriver();
    router.replace(ROUTES.deliveryLogin);
  }

  const recent = useMemo(() => data?.recentDeliveries ?? [], [data]);

  if (loading || !data) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-4"><div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-central-orange text-white"><Bike size={22} /></span><p className="mt-4 text-sm font-bold text-neutral-500">Cargando tus entregas…</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] pb-24 text-central-carbon">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-central-carbon text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.22em] text-central-orange">La Central · Delivery</p><p className="truncate text-base font-black">{data.driver.fullName}</p></div>
          <div className="flex items-center gap-2"><button onClick={() => void load(true)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/15" aria-label="Actualizar"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button><button onClick={() => void logout()} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/15" aria-label="Salir"><LogOut size={17} /></button></div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={Route} label="Activos" value={String(data.summary.activeAssignments)} helper="Pedidos asignados" />
          <SummaryCard icon={CircleDollarSign} label="Hoy" value={formatCurrency(data.summary.todayCommission)} helper="Comisión ganada" />
          <SummaryCard icon={WalletCards} label="Mes" value={formatCurrency(data.summary.monthCommission)} helper="Comisión acumulada" />
          <SummaryCard icon={Banknote} label="Efectivo" value={formatCurrency(data.summary.cashPending)} helper="Pendiente de rendir" />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-central-orange">Operación</p><h1 className="mt-1 text-xl font-black">Entregas asignadas</h1></div><span className="rounded-full bg-central-carbon px-3 py-1.5 text-xs font-black text-white">{data.activeAssignments.length}</span></div>
          <div className="space-y-4">
            {data.activeAssignments.map((item) => <AssignmentCard key={item.id} item={item} busy={busyId === item.id} onAdvance={(assignment) => void handleAdvance(assignment)} />)}
            {data.activeAssignments.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={22} /></span><p className="mt-4 font-black">No tenés entregas pendientes</p><p className="mt-1 text-sm text-neutral-500">Cuando administración te asigne un pedido aparecerá acá.</p></div> : null}
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-4"><p className="text-xs font-black uppercase tracking-[.16em] text-neutral-400">Ganancias</p><h2 className="mt-1 text-lg font-black">Últimas entregas</h2></div>
          <div className="divide-y divide-neutral-100">
            {recent.slice(0, 8).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-black">{item.orderCode} · {item.customerName}</p><p className="mt-1 text-xs text-neutral-500">{formatDateTime(item.deliveredAt)}</p></div><div className="text-right"><p className="text-sm font-black text-emerald-700">+{formatCurrency(item.commissionAmount)}</p>{item.cashToCollect > 0 ? <p className="mt-1 text-[11px] text-neutral-500">Cobrado {formatCurrency(item.cashToCollect)}</p> : null}</div></div>)}
            {recent.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">Todavía no hay entregas finalizadas.</p> : null}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-4"><p className="text-xs font-black uppercase tracking-[.16em] text-neutral-400">Liquidaciones</p><h2 className="mt-1 text-lg font-black">Estado de pagos</h2></div>
          <div className="space-y-3">
            {data.settlements.slice(0, 6).map((item) => <div key={item.id} className="rounded-xl bg-neutral-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black">{item.deliveries} entregas</p><p className="mt-1 text-xs text-neutral-500">{new Date(item.periodFrom).toLocaleDateString('es-AR')} — {new Date(item.periodTo).toLocaleDateString('es-AR')}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : item.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{item.status === 'paid' ? 'Pagada' : item.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}</span></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-neutral-500">Comisión</span><strong>{formatCurrency(item.commissionTotal)}</strong></div></div>)}
            {data.settlements.length === 0 ? <p className="py-6 text-center text-sm text-neutral-500">No hay liquidaciones generadas.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
