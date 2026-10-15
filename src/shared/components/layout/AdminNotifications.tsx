'use client';

import Link from 'next/link';
import { Bell, CheckCheck, Clock3, PackageCheck, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Order } from '@/features/pedidos/types/pedido.types';
import {
  getPedidos,
  getSeenOrderIds,
  markOrdersAsSeen,
  subscribeToOrders,
} from '@/features/pedidos/services/pedidos.service';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/utils/cn';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

function isIncomingOrder(order: Order) {
  return order.status === 'aceptado';
}

export function AdminNotifications() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  async function loadOrders() {
    try {
      const [data, storedSeenIds] = await Promise.all([getPedidos(), getSeenOrderIds()]);
      setOrders(data.slice(0, 8));
      setSeenIds(storedSeenIds);
      setError(null);
    } catch (err) {
      setOrders([]);
      setSeenIds([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las notificaciones.');
    }
  }

  useEffect(() => {
    loadOrders();
    return subscribeToOrders(loadOrders);
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!open) return;
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const unseenOrders = useMemo(
    () => orders.filter((order) => isIncomingOrder(order) && !seenIds.includes(order.id)),
    [orders, seenIds],
  );
  const unseenCount = unseenOrders.length;

  async function markAllAsSeen() {
    try {
      const nextSeenIds = Array.from(new Set([...seenIds, ...orders.map((order) => order.id)]));
      await markOrdersAsSeen(nextSeenIds);
      setSeenIds(nextSeenIds);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las notificaciones vistas.');
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative grid h-9 w-9 place-items-center rounded-[11px] border border-black/[.06] bg-white text-[#515154] shadow-[0_1px_3px_rgba(0,0,0,.06)] transition hover:text-[#0071e3]',
          unseenCount > 0 && 'border-[#0071e3]/20 bg-[#eaf3ff] text-[#0071e3]',
        )}
        aria-label={unseenCount > 0 ? `${unseenCount} pedidos nuevos` : 'Notificaciones de pedidos'}
        title="Notificaciones de pedidos"
      >
        <Bell size={18} className={cn(unseenCount > 0 && 'lcb-bell-vibrate')} />
        {unseenCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-[#f5f5f7]">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] sm:hidden"
          />
          <div className="fixed inset-x-3 top-20 z-50 flex max-h-[calc(100dvh-92px)] flex-col overflow-hidden rounded-[20px] border border-black/[.08] bg-white/95 text-[#1d1d1f] shadow-[0_24px_70px_rgba(0,0,0,.16)] backdrop-blur-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-none sm:w-[390px]">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#0071e3]">Pedidos</p>
                <h3 className="mt-1 text-lg font-semibold tracking-[-.025em]">Notificaciones</h3>
                <p className="mt-1 text-xs text-neutral-500">Pedidos recibidos desde el sitio.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-central-carbon"
                aria-label="Cerrar notificaciones"
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:max-h-[430px] sm:flex-none">
              {error ? (
                <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-sm border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                  Todavía no hay pedidos para mostrar.
                </div>
              ) : orders.map((order) => {
                const unseen = isIncomingOrder(order) && !seenIds.includes(order.id);
                return (
                  <Link
                    key={order.id}
                    href={ROUTES.adminPedidos}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'block rounded-[14px] border p-3 transition hover:border-[#0071e3]/25 hover:bg-[#f7fbff]',
                      unseen
                        ? 'border-[#0071e3]/20 bg-[#eaf3ff]'
                        : 'border-black/[.055] bg-[#f7f7f9] opacity-80',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs font-semibold text-[#0071e3]">{order.orderCode}</p>
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                            unseen
                              ? 'bg-[#0071e3] text-white'
                              : 'bg-neutral-200 text-neutral-500',
                          )}>
                            {unseen ? 'Nuevo' : 'Visto'}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold">{order.customerName}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro local'} · {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <strong className="shrink-0 text-sm text-central-carbon">{formatCurrency(order.total)}</strong>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-600">
                      {order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}
                    </p>
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-col items-stretch gap-3 border-t border-neutral-100 bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-500 sm:justify-start">
                {unseenCount > 0 ? (
                  <Clock3 size={15} className="text-[#0071e3]" />
                ) : (
                  <PackageCheck size={15} className="text-green-600" />
                )}
                {unseenCount > 0 ? `${unseenCount} sin ver` : 'Todo visto'}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="button"
                  onClick={markAllAsSeen}
                  disabled={Boolean(error) || orders.length === 0}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-[#0071e3]/30 hover:text-[#0071e3] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheck size={14} className="mr-1" /> Vistos
                </button>
                <Link
                  href={ROUTES.adminPedidos}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm bg-[#0071e3] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0066cc]"
                >
                  Ver pedidos
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
