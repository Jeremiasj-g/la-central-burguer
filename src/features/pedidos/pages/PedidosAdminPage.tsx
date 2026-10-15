'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, PackageCheck, RefreshCw, Search, XCircle } from 'lucide-react';
import { PedidosTable } from '../components/PedidosTable';
import { PedidosTableSkeleton } from '../components/PedidosTableSkeleton';
import { usePedidoMutations } from '../hooks/usePedidoMutations';
import { usePedidos } from '../hooks/usePedidos';
import type { OrderStatus } from '../types/pedido.types';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'aceptado', label: 'Aceptados' },
  { value: 'cancelado', label: 'Cancelados' },
] as const;

export function PedidosAdminPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const { pedidos, isLoading, error, refresh } = usePedidos({ search, status });
  const mutations = usePedidoMutations(refresh);

  useEffect(() => {
    document.body.classList.add('pedidos-wallet-active');
    return () => document.body.classList.remove('pedidos-wallet-active');
  }, []);

  async function confirmCancelOrder() {
    if (!pendingCancelId) return;
    await mutations.cancel(pendingCancelId);
    setPendingCancelId(null);
  }

  const acceptedCount = pedidos.filter((order) => order.status === 'aceptado').length;
  const cancelledCount = pedidos.filter((order) => order.status === 'cancelado').length;
  const hasFilters = Boolean(search.trim()) || status !== 'all';

  return (
    <div className="pedidos-wallet min-w-0 pb-8">
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] text-neutral-950 sm:text-[34px]">
            Gestión de pedidos
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-neutral-500">
            Seguí los pedidos de tu tienda y administrá sus cancelaciones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 self-start rounded-[11px] border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-700 transition-[background-color,border-color,color,transform] duration-200 hover:border-neutral-300 hover:bg-neutral-50 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Actualizar listado de pedidos"
          title="Actualizar pedidos"
        >
          <RefreshCw size={14} strokeWidth={1.9} className={isLoading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <section aria-label="Resumen de resultados de pedidos" className="relative mb-5 flex min-w-0 flex-col overflow-hidden rounded-[23px] bg-[#191b20] p-5 text-white shadow-soft sm:p-6 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-central-orange/10 blur-[60px]" aria-hidden="true" />
        <div className="relative min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-white/10 bg-white/[.08]">
              <ClipboardList size={18} strokeWidth={1.7} className="text-white/75" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/45">Resumen de resultados</span>
          </div>
          <p className="mt-5 text-[12px] font-normal text-white/60">Pedidos en la vista actual</p>
          <p className="mt-1 text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-[-.055em] tabular-nums">
            {isLoading ? '—' : pedidos.length.toLocaleString('es-AR')}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-white/40">
            El resumen refleja los filtros seleccionados.
          </p>
        </div>

        <div className="relative mt-6 grid min-w-0 grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:max-w-[430px] xl:mt-0 xl:w-[42%] xl:border-l xl:border-t-0 xl:pb-1 xl:pl-6 xl:pt-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-emerald-300/85">
              <CheckCircle2 size={14} strokeWidth={1.8} />
              <span className="text-[11px] text-white/55">Aceptados</span>
            </div>
            <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-.045em] tabular-nums text-[#c7f0d7]">
              {isLoading ? '—' : acceptedCount.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-4">
            <div className="flex items-center gap-1.5 text-red-300/85">
              <XCircle size={14} strokeWidth={1.8} />
              <span className="text-[11px] text-white/55">Cancelados</span>
            </div>
            <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-.045em] tabular-nums text-white/85">
              {isLoading ? '—' : cancelledCount.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Filtros del listado de pedidos" className="mb-5 min-w-0 rounded-[20px] border border-neutral-200/70 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold tracking-[-.025em] text-neutral-900">Encontrá un pedido</h2>
          <p className="mt-0.5 text-[11px] leading-5 text-neutral-500">Buscá por código, cliente o teléfono y filtrá por estado.</p>
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Buscar</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} strokeWidth={1.8} />
              <Input
                className="!h-10 !w-full !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !pl-10 !pr-3 !text-[12px] !font-normal !text-neutral-900 !shadow-none placeholder:!text-neutral-400 focus:!border-central-orange/45 focus:!bg-white"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Código, nombre o teléfono"
              />
            </span>
          </label>
          <div className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Estado</span>
            <Select
              aria-label="Filtrar pedidos por estado"
              variant="light"
              value={status}
              options={STATUS_OPTIONS}
              onValueChange={(nextStatus) => setStatus(nextStatus as 'all' | OrderStatus)}
              className="!h-10 !rounded-[11px] !border-neutral-200/80 !bg-[#f7f7f9] !px-3 !text-[12px] !font-normal !shadow-none"
              contentClassName="!rounded-[13px]"
            />
          </div>
        </div>
      </section>

      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 px-0.5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-.035em] text-neutral-950">Listado de pedidos</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {isLoading ? 'Actualizando información…' : `${pedidos.length.toLocaleString('es-AR')} ${pedidos.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
        </div>
        {!isLoading && hasFilters ? (
          <span className="rounded-full bg-central-orange/10 px-3 py-1.5 text-[11px] font-medium text-central-ember">
            Filtros activos
          </span>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-[17px] border border-red-200/80 bg-red-50 px-5 py-4 text-[13px] leading-5 text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <PedidosTableSkeleton />
      ) : pedidos.length > 0 ? (
        <PedidosTable orders={pedidos} onCancelOrder={setPendingCancelId} />
      ) : (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-neutral-200/70 bg-white px-5 py-10 text-center shadow-soft">
          <span className="grid h-13 w-13 place-items-center rounded-[16px] bg-[#f7f7f9] text-neutral-400">
            <PackageCheck size={23} strokeWidth={1.6} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold text-neutral-900">
            {hasFilters ? 'No encontramos pedidos' : 'Todavía no hay pedidos'}
          </h3>
          <p className="mt-1 max-w-sm text-[12px] leading-5 text-neutral-500">
            {hasFilters
              ? 'Probá con otra búsqueda o cambiá el filtro de estado.'
              : 'Los pedidos confirmados desde el sitio aparecerán acá automáticamente.'}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingCancelId)}
        title="Cancelar pedido"
        description="¿Seguro que querés marcar este pedido como cancelado? Usá esta acción solo si el cliente canceló por WhatsApp."
        confirmLabel="Marcar cancelado"
        tone="danger"
        theme="light"
        isLoading={mutations.isSaving}
        onCancel={() => setPendingCancelId(null)}
        onConfirm={confirmCancelOrder}
      />
    </div>
  );
}
