import type { Order } from '@/features/pedidos/types/pedido.types';
import { Badge } from '@/shared/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

export function RecentOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-soft">
      <div className="border-b border-neutral-200 p-6">
        <h3 className="text-lg font-black text-central-carbon">Últimos pedidos</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[.18em] text-neutral-500">
            <tr>
              <th className="px-6 py-4">Pedido</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 font-mono font-black text-central-orange">{order.orderCode}</td>
                <td className="px-6 py-4 font-bold text-central-carbon">{order.customerName}</td>
                <td className="px-6 py-4 text-neutral-500">{formatDateTime(order.createdAt)}</td>
                <td className="px-6 py-4"><Badge tone={order.status === 'cancelado' ? 'red' : 'orange'}>{order.status.replaceAll('_', ' ')}</Badge></td>
                <td className="px-6 py-4 text-right font-black text-central-carbon">{formatCurrency(order.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
