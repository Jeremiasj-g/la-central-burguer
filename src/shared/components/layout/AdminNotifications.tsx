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
          'relative grid h-10 w-10 place-items-center rounded-full bg-[#F2F2F7] text-[#1C1C1E] transition hover:bg-[#E9E9EE] active:scale-95',
          unseenCount > 0 && 'bg-[#FFF3E0] text-[#FF9500] hover:bg-[#FFE7C2]',
        )}
        aria-label={unseenCount > 0 ? `${unseenCount} pedidos nuevos` : 'Notificaciones de pedidos'}
        title="Notificaciones de pedidos"
      >
        <Bell size={18} className={cn(unseenCount > 0 && 'lcb-bell-vibrate')} />
        {unseenCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#FF3B30] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,400px)] overflow-hidden rounded-[24px] border border-black/[0.06] bg-white/96 text-[#1C1C1E] shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-[#E5E5EA] px-5 py-4">
            <div>
              <p className="text-[11px] font-medium text-[#8E8E93]">Pedidos</p>
              <h3 className="mt-0.5 text-[20px] font-semibold tracking-[-0.025em]">Notificaciones</h3>
              <p className="mt-1 text-[12px] text-[#8E8E93]">Pedidos recibidos desde el sitio.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#F2F2F7] text-[#8E8E93] transition hover:text-[#1C1C1E] active:scale-95"
              aria-label="Cerrar notificaciones"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[430px] space-y-2 overflow-y-auto bg-[#F7F7FA] p-3 custom-scrollbar">
            {error ? (
              <div className="rounded-[16px] border border-[#FF3B30]/15 bg-[#FFF0EF] p-4 text-[13px] text-[#C9342B]">
                {error}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[#D1D1D6] bg-white p-6 text-center text-[13px] text-[#8E8E93]">
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
                    'block rounded-[18px] border bg-white p-3.5 transition active:scale-[0.992]',
                    unseen
                      ? 'border-[#FF9500]/25 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.035)]'
                      : 'border-black/[0.04] opacity-80',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-[11px] font-semibold text-[#FF9500]">{order.orderCode}</p>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          unseen
                            ? 'bg-[#FFF3E0] text-[#C86E00]'
                            : 'bg-[#F2F2F7] text-[#8E8E93]',
                        )}>
                          {unseen ? 'Nuevo' : 'Visto'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[14px] font-semibold">{order.customerName}</p>
                      <p className="mt-0.5 text-[11px] text-[#8E8E93]">
                        {order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro local'} · {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <strong className="shrink-0 text-[13px] font-semibold text-[#1C1C1E]">{formatCurrency(order.total)}</strong>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-4.5 text-[#636366]">
                    {order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#E5E5EA] bg-white px-3.5 py-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-[#8E8E93]">
              {unseenCount > 0 ? (
                <Clock3 size={14} className="text-[#FF9500]" />
              ) : (
                <PackageCheck size={14} className="text-[#34C759]" />
              )}
              {unseenCount > 0 ? `${unseenCount} sin ver` : 'Todo visto'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={markAllAsSeen}
                disabled={Boolean(error) || orders.length === 0}
                className="rounded-full bg-[#F2F2F7] px-3 py-2 text-[11px] font-semibold text-[#636366] transition hover:bg-[#E9E9EE] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck size={13} className="mr-1 inline" /> Vistos
              </button>
              <Link
                href={ROUTES.adminPedidos}
                onClick={() => setOpen(false)}
                className="rounded-full bg-[#FF9500] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#E88300] active:scale-[0.98]"
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
