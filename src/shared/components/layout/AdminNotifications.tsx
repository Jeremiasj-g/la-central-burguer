'use client';
// Validación temporal de CI para las notificaciones wallet.

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
import { useAnimatedPresence } from '@/shared/hooks/useAnimatedPresence';
import { cn } from '@/shared/utils/cn';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

function isIncomingOrder(order: Order) {
  return order.status === 'aceptado';
}

export function AdminNotifications() {
  const [open, setOpen] = useState(false);
  const mounted = useAnimatedPresence(open);
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

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
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
          'relative grid h-10 w-10 cursor-pointer place-items-center rounded-[11px] border border-neutral-200/80 bg-[#f7f7f9] text-neutral-600 outline-none transition-[border-color,background-color,color,box-shadow,transform] duration-200 hover:border-central-orange/35 hover:bg-central-orange/[.06] hover:text-central-orange focus-visible:ring-2 focus-visible:ring-central-orange/30 active:scale-[.97]',
          (open || unseenCount > 0) && 'border-central-orange/30 bg-central-orange/[.07] text-central-orange',
        )}
        aria-label={unseenCount > 0 ? `${unseenCount} pedidos nuevos` : 'Notificaciones de pedidos'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="admin-notifications-panel"
        title="Notificaciones de pedidos"
      >
        <Bell size={18} strokeWidth={1.85} className={cn(unseenCount > 0 && 'lcb-bell-vibrate')} />
        {unseenCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-[19px] min-w-[19px] place-items-center rounded-full bg-central-orange px-1.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        ) : null}
      </button>

      {mounted ? (
        <>
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            onClick={() => setOpen(false)}
            data-state={open ? 'open' : 'closed'}
            aria-hidden="true"
            tabIndex={-1}
            className={cn('lcb-notifications-backdrop fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] sm:hidden', !open && 'pointer-events-none')}
          />
          <div
            id="admin-notifications-panel"
            role="dialog"
            aria-labelledby="admin-notifications-title"
            aria-hidden={!open}
            inert={!open}
            data-state={open ? 'open' : 'closed'}
            className={cn(
              'lcb-notifications-panel fixed inset-x-3 top-[76px] z-50 flex max-h-[calc(100dvh-88px)] flex-col overflow-hidden rounded-[21px] border border-neutral-200/80 bg-white text-neutral-900 shadow-[0_26px_70px_-20px_rgba(17,16,15,.32)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[52px] sm:max-h-[min(540px,calc(100dvh-90px))] sm:w-[410px]',
              !open && 'pointer-events-none',
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-central-orange/[.10] text-central-orange">
                  <Bell size={19} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h3 id="admin-notifications-title" className="text-[17px] font-semibold leading-6 tracking-[-.035em] text-neutral-950">Notificaciones</h3>
                  <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">Actividad reciente de tu tienda.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[10px] text-neutral-400 transition-colors duration-200 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-central-orange/25"
                aria-label="Cerrar notificaciones"
              >
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto bg-white p-3 sm:px-4 sm:py-3">
              {error ? (
                <div role="alert" className="rounded-[13px] border border-red-200/80 bg-red-50 px-4 py-3 text-[12px] leading-5 text-red-700">
                  {error}
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center rounded-[15px] border border-dashed border-neutral-200 bg-[#fafafa] px-5 py-8 text-center">
                  <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-400">
                    <PackageCheck size={19} strokeWidth={1.7} />
                  </span>
                  <p className="text-[13px] font-medium text-neutral-700">Sin novedades por ahora</p>
                  <p className="mt-1 text-[11px] text-neutral-500">Los últimos pedidos aparecerán acá.</p>
                </div>
              ) : orders.map((order) => {
                const unseen = isIncomingOrder(order) && !seenIds.includes(order.id);
                return (
                  <Link
                    key={order.id}
                    href={ROUTES.adminPedidos}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'group block rounded-[15px] border px-3.5 py-3.5 outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-[1px] hover:shadow-[0_8px_22px_-16px_rgba(17,16,15,.35)] focus-visible:ring-2 focus-visible:ring-central-orange/25',
                      unseen
                        ? 'border-central-orange/25 bg-central-orange/[.055] hover:border-central-orange/45 hover:bg-central-orange/[.085]'
                        : 'border-neutral-200/75 bg-[#fafafa] hover:border-neutral-300 hover:bg-white',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-[11px] font-semibold tracking-[-.02em] text-central-ember">{order.orderCode}</p>
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            unseen
                              ? 'bg-central-orange/15 text-central-ember'
                              : 'bg-neutral-200/75 text-neutral-500',
                          )}>
                            {unseen ? 'Nuevo' : 'Visto'}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-[13px] font-semibold tracking-[-.015em] text-neutral-900">{order.customerName}</p>
                        <p className="mt-1 text-[11px] leading-4 text-neutral-500">
                          {order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro local'} · {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <strong className="shrink-0 text-[12px] font-semibold tabular-nums text-neutral-900">{formatCurrency(order.total)}</strong>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-[18px] text-neutral-500">
                      {order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}
                    </p>
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-col items-stretch gap-3 border-t border-neutral-100 bg-[#fafafa] px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-neutral-500 sm:justify-start">
                {unseenCount > 0 ? (
                  <Clock3 size={15} strokeWidth={1.8} className="text-central-orange" />
                ) : (
                  <PackageCheck size={15} strokeWidth={1.8} className="text-emerald-600" />
                )}
                {unseenCount > 0 ? `${unseenCount} sin ver` : 'Todo visto'}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="button"
                  onClick={markAllAsSeen}
                  disabled={Boolean(error) || orders.length === 0}
                  className="inline-flex min-h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-[11px] font-medium text-neutral-600 transition-[border-color,background-color,color] duration-200 hover:border-central-orange/40 hover:bg-central-orange/[.05] hover:text-central-orange disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheck size={14} className="mr-1" /> Vistos
                </button>
                <Link
                  href={ROUTES.adminPedidos}
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#191b20] px-3 py-2 text-[11px] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-neutral-700 active:scale-[.98]"
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
