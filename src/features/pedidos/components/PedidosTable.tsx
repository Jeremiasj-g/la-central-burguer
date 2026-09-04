'use client';

import { XCircle } from 'lucide-react';
import type { Order } from '../types/pedido.types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

export function PedidosTable({ orders, onCancelOrder }: { orders: Order[]; onCancelOrder: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="overflow-x-auto custom-scrollbar md:overflow-x-hidden">
        <table className="w-full min-w-[980px] table-fixed text-sm text-neutral-700 md:min-w-0">
          <colgroup>
            <col className="w-[25%] xl:w-[16%]" />
            <col className="w-[30%] xl:w-[17%]" />
            <col className="hidden xl:table-column xl:w-[24%]" />
            <col className="w-[15%] xl:w-[12%]" />
            <col className="hidden xl:table-column xl:w-[14%]" />
            <col className="w-[15%] xl:w-[10%]" />
            <col className="w-[15%] xl:w-[7%]" />
          </colgroup>
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-500">
            <tr>
              <th className="px-3 py-4 xl:px-4 2xl:px-6">Pedido</th>
              <th className="px-3 py-4 xl:px-4 2xl:px-6">Cliente</th>
              <th className="hidden px-3 py-4 xl:table-cell xl:px-4 2xl:px-6">Productos</th>
              <th className="px-3 py-4 xl:px-4 2xl:px-6">Estado</th>
              <th className="hidden px-3 py-4 xl:table-cell xl:px-4 2xl:px-6">Fecha</th>
              <th className="px-3 py-4 text-right xl:px-4 2xl:px-6">Total</th>
              <th className="px-3 py-4 text-right xl:px-4 2xl:px-6">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-3 py-4 xl:px-4 2xl:px-6">
                  <p className="truncate font-mono font-black text-central-orange" title={order.orderCode}>{order.orderCode}</p>
                  <p className="line-clamp-2 break-words text-xs text-neutral-500" title={order.deliveryMethod === 'delivery' ? order.address : 'Retiro en local'}>{order.deliveryMethod === 'delivery' ? order.address : 'Retiro en local'}</p>
                  <p className="mt-1 truncate text-xs text-neutral-500 xl:hidden" title={formatDateTime(order.createdAt)}>{formatDateTime(order.createdAt)}</p>
                  {order.deliveryMapsUrl ? <a className="mt-1 inline-flex text-xs font-bold text-central-orange hover:text-central-ember" href={order.deliveryMapsUrl} target="_blank" rel="noreferrer">Ver ubicación</a> : null}
                  {typeof order.deliveryDistanceKm === 'number' ? <p className="mt-1 text-xs text-neutral-500">Distancia aprox.: {order.deliveryDistanceKm.toFixed(1)} km</p> : null}
                </td>
                <td className="px-3 py-4 xl:px-4 2xl:px-6">
                  <p className="truncate font-black text-central-carbon" title={order.customerName}>{order.customerName}</p>
                  <p className="truncate text-xs text-neutral-500" title={order.customerPhone}>{order.customerPhone}</p>
                  <p className="mt-1 line-clamp-2 break-words text-xs text-neutral-500 xl:hidden" title={order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}>{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}</p>
                </td>
                <td className="hidden px-3 py-4 text-neutral-600 xl:table-cell xl:px-4 2xl:px-6">
                  <p className="line-clamp-3 break-words" title={order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}>{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}</p>
                </td>
                <td className="px-3 py-4 xl:px-4 2xl:px-6">
                  <Badge className="max-w-full truncate" tone={order.status === 'cancelado' ? 'red' : 'green'}>{order.status.replaceAll('_', ' ')}</Badge>
                </td>
                <td className="hidden px-3 py-4 text-neutral-500 xl:table-cell xl:px-4 2xl:px-6"><p className="line-clamp-2" title={formatDateTime(order.createdAt)}>{formatDateTime(order.createdAt)}</p></td>
                <td className="px-3 py-4 text-right xl:px-4 2xl:px-6">
                  <p className="whitespace-nowrap font-black text-central-carbon">{formatCurrency(order.total)}</p>
                  {order.deliveryMethod === 'delivery' ? <p className="text-xs text-neutral-500">Envío: {order.deliveryCost > 0 ? formatCurrency(order.deliveryCost) : 'A confirmar'}</p> : null}
                </td>
                <td className="px-3 py-4 text-right xl:px-4 2xl:px-6">
                  {order.status === 'cancelado' ? (
                    <span className="text-xs font-bold text-neutral-400">Sin acciones</span>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      className="ml-auto h-9 w-9 rounded-sm px-0 text-xs"
                      aria-label="Cancelar pedido"
                      title="Marcar este pedido como cancelado"
                      onClick={() => onCancelOrder(order.id)}
                    >
                      <XCircle size={15} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
