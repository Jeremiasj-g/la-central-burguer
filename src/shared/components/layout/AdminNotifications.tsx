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
          'relative grid h-10 w-10 place-items-center rounded-sm border border-neutral-200 bg-white text-central-carbon shadow-sm transition hover:border-central-orange hover:text-central-orange',
          unseenCount > 0 && 'border-central-orange/50 bg-central-orange/10 text-central-orange',
        )}
        aria-label={unseenCount > 0 ? `${unseenCount} pedidos nuevos` : 'Notificaciones de pedidos'}
        title="Notificaciones de pedidos"
      >
        <Bell size={18} className={cn(unseenCount > 0 && 'lcb-bell-vibrate')} />
        {unseenCount > 0 ? (
          <span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,390px)] overflow-hidden rounded-sm border border-neutral-200 bg-white text-central-carbon shadow-dark">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-central-orange">Pedidos</p>
              <h3 className="mt-1 text-lg font-black">Notificaciones</h3>
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

          <div className="max-h-[430px] space-y-2 overflow-y-auto p-3 custom-scrollbar">
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
                    'block rounded-sm border p-3 transition hover:border-central-orange hover:bg-central-orange/5',
                    unseen
                      ? 'border-central-orange/55 bg-central-orange/10'
                      : 'border-neutral-200 bg-neutral-50 opacity-75',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xs font-black text-central-orange">{order.orderCode}</p>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-black uppercase',
                          unseen
                            ? 'bg-central-orange text-white'
                            : 'bg-neutral-200 text-neutral-500',
                        )}>
                          {unseen ? 'Nuevo' : 'Visto'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-black">{order.customerName}</p>
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

          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-500">
              {unseenCount > 0 ? (
                <Clock3 size={15} className="text-central-orange" />
              ) : (
                <PackageCheck size={15} className="text-green-600" />
              )}
              {unseenCount > 0 ? `${unseenCount} sin ver` : 'Todo visto'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={markAllAsSeen}
                disabled={Boolean(error) || orders.length === 0}
                className="rounded-sm border border-neutral-200 bg-white px-3 py-2 text-xs font-black text-neutral-700 transition hover:border-central-orange hover:text-central-orange disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck size={14} className="mr-1 inline" /> Vistos
              </button>
              <Link
                href={ROUTES.adminPedidos}
                onClick={() => setOpen(false)}
                className="rounded-sm bg-central-orange px-3 py-2 text-xs font-black text-white transition hover:bg-central-ember"
              >
                Ver pedidos
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
