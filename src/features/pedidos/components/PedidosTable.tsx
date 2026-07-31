'use client';

import { XCircle } from 'lucide-react';
import type { Order } from '../types/pedido.types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

export function PedidosTable({ orders, onCancelOrder }: { orders: Order[]; onCancelOrder: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[980px] text-sm text-neutral-700">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-500">
            <tr>
              <th className="px-6 py-4">Pedido</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Productos</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4">
                  <p className="font-mono font-black text-central-orange">{order.orderCode}</p>
                  <p className="text-xs text-neutral-500">{order.deliveryMethod === 'delivery' ? order.address : 'Retiro en local'}</p>
                  {order.deliveryMapsUrl ? <a className="mt-1 inline-flex text-xs font-bold text-central-orange hover:text-central-ember" href={order.deliveryMapsUrl} target="_blank" rel="noreferrer">Ver ubicación</a> : null}
                  {typeof order.deliveryDistanceKm === 'number' ? <p className="mt-1 text-xs text-neutral-500">Distancia aprox.: {order.deliveryDistanceKm.toFixed(1)} km</p> : null}
                </td>
                <td className="px-6 py-4">
                  <p className="font-black text-central-carbon">{order.customerName}</p>
                  <p className="text-xs text-neutral-500">{order.customerPhone}</p>
                </td>
                <td className="px-6 py-4 text-neutral-600">{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ')}</td>
                <td className="px-6 py-4">
                  <Badge tone={order.status === 'cancelado' ? 'red' : 'green'}>{order.status.replaceAll('_', ' ')}</Badge>
                </td>
                <td className="px-6 py-4 text-neutral-500">{formatDateTime(order.createdAt)}</td>
                <td className="px-6 py-4 text-right">
                  <p className="font-black text-central-carbon">{formatCurrency(order.total)}</p>
                  {order.deliveryMethod === 'delivery' ? <p className="text-xs text-neutral-500">Envío: {order.deliveryCost > 0 ? formatCurrency(order.deliveryCost) : 'A confirmar'}</p> : null}
                </td>
                <td className="px-6 py-4 text-right">
                  {order.status === 'cancelado' ? (
                    <span className="text-xs font-bold text-neutral-400">Sin acciones</span>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      className="h-9 rounded-sm px-3 text-xs"
                      title="Marcar este pedido como cancelado"
                      onClick={() => onCancelOrder(order.id)}
                    >
                      <XCircle size={15} /> Cancelar
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
