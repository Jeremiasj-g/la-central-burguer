import type { Order } from '@/features/pedidos/types/pedido.types';
import { Badge } from '@/shared/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/shared/utils/format.utils';

export function RecentOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[20px] border border-neutral-200/70 bg-white shadow-soft">
      <div className="border-b border-neutral-100 px-4 py-4 sm:px-5">
        <h3 className="text-[15px] font-semibold tracking-[-.025em] text-central-carbon sm:text-[16px]">Últimos pedidos</h3>
      </div>
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead className="bg-[#f8f8f9] text-left text-[10px] font-medium uppercase tracking-[.08em] text-neutral-500">
            <tr>
              <th className="px-4 py-3.5 sm:px-5">Pedido</th>
              <th className="px-4 py-3.5 sm:px-5">Cliente</th>
              <th className="px-4 py-3.5 sm:px-5">Fecha</th>
              <th className="px-4 py-3.5 sm:px-5">Estado</th>
              <th className="px-4 py-3.5 sm:px-5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.map((order) => (
              <tr key={order.id} className="transition-colors duration-200 hover:bg-[#fafafa]">
                <td className="px-4 py-3.5 sm:px-5 font-mono font-semibold text-central-orange">{order.orderCode}</td>
                <td className="px-4 py-3.5 sm:px-5 font-semibold text-central-carbon">{order.customerName}</td>
                <td className="px-4 py-3.5 sm:px-5 text-neutral-500">{formatDateTime(order.createdAt)}</td>
                <td className="px-4 py-3.5 sm:px-5"><Badge tone={order.status === 'cancelado' ? 'red' : 'orange'}>{order.status.replaceAll('_', ' ')}</Badge></td>
                <td className="px-4 py-3.5 sm:px-5 text-right font-semibold tabular-nums text-central-carbon">{formatCurrency(order.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
