'use client';

import { CalendarDays, ExternalLink, MapPin, Truck, UserRound, XCircle } from 'lucide-react';
import type { Order } from '../types/pedido.types';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

type PedidosTableProps = {
  orders: Order[];
  onCancelOrder: (id: string) => void;
};

function OrderStatus({ order }: { order: Order }) {
  const cancelled = order.status === 'cancelado';
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${cancelled ? 'bg-red-50 text-red-700 ring-red-200/75' : 'bg-emerald-50 text-emerald-700 ring-emerald-200/75'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cancelled ? 'bg-red-500' : 'bg-emerald-500'}`} />
      <span className="truncate capitalize">{order.status.replaceAll('_', ' ')}</span>
    </span>
  );
}

function CancelOrderButton({ order, onCancelOrder, compact = false }: {
  order: Order;
  onCancelOrder: (id: string) => void;
  compact?: boolean;
}) {
  if (order.status === 'cancelado') {
    return <span className="text-[11px] font-normal text-neutral-400">Sin acciones</span>;
  }

  return (
    <button
      type="button"
      aria-label={`Cancelar pedido ${order.orderCode}`}
      title="Marcar este pedido como cancelado"
      onClick={() => onCancelOrder(order.id)}
      className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-red-200/80 bg-red-50 px-3 text-[11px] font-medium text-red-600 outline-none transition-[background-color,border-color,transform] duration-200 hover:border-red-300 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-300/40 active:scale-[.97] ${compact ? 'w-9 px-0' : ''}`}
    >
      <XCircle size={15} strokeWidth={1.8} />
      {!compact ? 'Cancelar' : null}
    </button>
  );
}

function OrderCard({ order, onCancelOrder }: { order: Order; onCancelOrder: (id: string) => void }) {
  const products = order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ');
  const delivery = order.deliveryMethod === 'delivery';

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-neutral-200/75 bg-white p-4 shadow-[0_8px_28px_-24px_rgba(20,20,20,.3)] transition-[border-color,box-shadow] duration-200 hover:border-neutral-300 hover:shadow-[0_12px_32px_-24px_rgba(20,20,20,.4)]">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-neutral-100 pb-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[12px] font-semibold tracking-[-.025em] text-central-ember" title={order.orderCode}>
            {order.orderCode}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <CalendarDays size={13} strokeWidth={1.8} />
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatus order={order} />
      </div>

      <div className="mt-3 min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#f5f5f7] text-neutral-500">
            <UserRound size={15} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-neutral-900" title={order.customerName}>{order.customerName}</p>
            <p className="truncate text-[11px] text-neutral-500" title={order.customerPhone}>{order.customerPhone}</p>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 break-words text-[12px] leading-5 text-neutral-600" title={products}>
          {products}
        </p>
      </div>

      <div className="mt-4 min-w-0 rounded-[12px] bg-[#f8f8f9] px-3 py-2.5">
        <p className="flex items-center gap-2 text-[11px] font-medium text-neutral-700">
          {delivery ? <Truck size={14} strokeWidth={1.8} className="shrink-0 text-neutral-500" /> : <MapPin size={14} strokeWidth={1.8} className="shrink-0 text-neutral-500" />}
          {delivery ? 'Delivery' : 'Retiro en local'}
        </p>
        {delivery && order.address ? (
          <p className="mt-1 line-clamp-2 break-words text-[11px] leading-[18px] text-neutral-500" title={order.address}>{order.address}</p>
        ) : null}
        {typeof order.deliveryDistanceKm === 'number' ? (
          <p className="mt-1 text-[11px] text-neutral-500">Distancia aprox.: {order.deliveryDistanceKm.toFixed(1)} km</p>
        ) : null}
        {order.deliveryMapsUrl ? (
          <a href={order.deliveryMapsUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-central-ember transition-colors duration-200 hover:text-central-orange">
            Ver ubicación <ExternalLink size={12} strokeWidth={1.8} />
          </a>
        ) : null}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="min-w-0">
          <p className="text-[10px] text-neutral-400">Total del pedido</p>
          <p className="mt-0.5 break-words text-[19px] font-semibold leading-tight tracking-[-.04em] tabular-nums text-neutral-950">
            {formatCurrency(order.total)}
          </p>
          {delivery ? (
            <p className="mt-1 text-[10px] text-neutral-500">
              Envío: {order.deliveryCost > 0 ? formatCurrency(order.deliveryCost) : 'A confirmar'}
            </p>
          ) : null}
        </div>
        <CancelOrderButton order={order} onCancelOrder={onCancelOrder} />
      </div>
    </article>
  );
}

export function PedidosTable({ orders, onCancelOrder }: PedidosTableProps) {
  return (
    <section aria-label="Resultados de pedidos" className="min-w-0">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:hidden">
        {orders.map((order) => <OrderCard key={order.id} order={order} onCancelOrder={onCancelOrder} />)}
      </div>

      <div className="hidden min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/75 bg-white shadow-soft xl:block">
        <table className="w-full table-fixed text-left text-[12px] text-neutral-700">
          <colgroup>
            <col className="w-[31%] 2xl:w-[20%]" />
            <col className="w-[31%] 2xl:w-[19%]" />
            <col className="hidden 2xl:table-column 2xl:w-[19%]" />
            <col className="w-[14%] 2xl:w-[11%]" />
            <col className="hidden 2xl:table-column 2xl:w-[14%]" />
            <col className="w-[16%] 2xl:w-[11%]" />
            <col className="w-[8%] 2xl:w-[6%]" />
          </colgroup>
          <thead className="border-b border-neutral-100 bg-[#f8f8f9] text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
            <tr>
              <th className="px-4 py-3.5 font-medium">Pedido</th>
              <th className="px-4 py-3.5 font-medium">Cliente</th>
              <th className="hidden px-4 py-3.5 font-medium 2xl:table-cell">Productos</th>
              <th className="px-3 py-3.5 font-medium">Estado</th>
              <th className="hidden px-4 py-3.5 font-medium 2xl:table-cell">Fecha</th>
              <th className="px-3 py-3.5 text-right font-medium">Total</th>
              <th className="px-2 py-3.5 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => {
              const products = order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ');
              const delivery = order.deliveryMethod === 'delivery';

              return (
                <tr key={order.id} className="transition-colors duration-200 hover:bg-[#fafafa]">
                  <td className="px-4 py-3.5 align-top">
                    <p className="truncate font-mono text-[12px] font-semibold tracking-[-.025em] text-central-ember" title={order.orderCode}>
                      {order.orderCode}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-neutral-500" title={delivery ? order.address : 'Retiro en local'}>
                      {delivery ? order.address : 'Retiro en local'}
                    </p>
                    <p className="mt-1 truncate text-[10px] text-neutral-400 2xl:hidden" title={formatDateTime(order.createdAt)}>
                      {formatDateTime(order.createdAt)}
                    </p>
                    {order.deliveryMapsUrl ? (
                      <a href={order.deliveryMapsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-central-ember transition-colors duration-200 hover:text-central-orange">
                        Ver ubicación <ExternalLink size={11} />
                      </a>
                    ) : null}
                    {typeof order.deliveryDistanceKm === 'number' ? (
                      <p className="mt-1 text-[10px] text-neutral-500">Distancia aprox.: {order.deliveryDistanceKm.toFixed(1)} km</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <p className="truncate text-[12px] font-semibold text-neutral-900" title={order.customerName}>{order.customerName}</p>
                    <p className="mt-1 truncate text-[11px] text-neutral-500" title={order.customerPhone}>{order.customerPhone}</p>
                    <p className="mt-1 line-clamp-2 break-words text-[11px] text-neutral-500 2xl:hidden" title={products}>{products}</p>
                  </td>
                  <td className="hidden px-4 py-3.5 align-top text-[11px] leading-5 text-neutral-500 2xl:table-cell">
                    <p className="line-clamp-3 break-words" title={products}>{products}</p>
                  </td>
                  <td className="px-3 py-3.5 align-top">
                    <OrderStatus order={order} />
                  </td>
                  <td className="hidden px-4 py-3.5 align-top text-[11px] leading-5 text-neutral-500 2xl:table-cell">
                    <p className="line-clamp-2" title={formatDateTime(order.createdAt)}>{formatDateTime(order.createdAt)}</p>
                  </td>
                  <td className="px-3 py-3.5 text-right align-top">
                    <p className="break-words text-[12px] font-semibold tabular-nums text-neutral-900">{formatCurrency(order.total)}</p>
                    {delivery ? (
                      <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                        Envío: {order.deliveryCost > 0 ? formatCurrency(order.deliveryCost) : 'A confirmar'}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3.5 text-right align-top">
                    <CancelOrderButton order={order} onCancelOrder={onCancelOrder} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
