'use client';

import { ArrowRight, Clock3, Package, ShoppingBag, Wallet } from 'lucide-react';
import type { CustomerAccount, CustomerOrderSummary } from '../services/customer-account.service';

type Props = {
  account: CustomerAccount;
  orders: CustomerOrderSummary[];
  dark: boolean;
  onViewOrders: () => void;
};

const money = (amount: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

export function CustomerDashboard({ account, orders, dark, onViewOrders }: Props) {
  const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const lastOrder = [...orders].sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
  const recent = [...orders].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const primary = dark ? 'text-white' : 'text-[#191b20]';
  const muted = dark ? 'text-white/55' : 'text-neutral-500';
  const border = dark ? 'border-white/10' : 'border-neutral-200';

  return <section className="lcb-account-section max-w-[980px]">
    <div className="mb-8">
      <h2 className={`text-[23px] font-semibold tracking-tight ${primary}`}>
        ¡Hola, {account.name.trim().split(/\s+/)[0] || 'bienvenido'}!
      </h2>
      <p className={`mt-2 text-[13px] ${muted}`}>Este es el resumen de tus pedidos vinculados a tu cuenta.</p>
    </div>
    <div className={`grid grid-cols-1 gap-5 border-y py-6 sm:grid-cols-3 sm:gap-0 ${border}`}>
      {[
        { label: 'Pedidos realizados', value: String(orders.length), Icon: ShoppingBag },
        { label: 'Importe en pedidos', value: money(total), Icon: Wallet },
        { label: 'Último pedido', value: lastOrder ? new Date(lastOrder.createdAt).toLocaleDateString('es-AR') : '—', Icon: Clock3 },
      ].map(({ label, value, Icon }, index) => <div key={label}
        className={`min-w-0 ${index > 0 ? `sm:border-l sm:pl-6 ${border}` : ''}`}>
        <span className={`flex items-center gap-2 text-[12px] ${muted}`}><Icon size={16}/>{label}</span>
        <p className={`mt-2 break-words text-[23px] font-semibold tabular-nums ${primary}`}>{value}</p>
      </div>)}
    </div>
    <div className="mt-10 flex items-center justify-between gap-3">
      <h3 className={`text-[17px] font-semibold ${primary}`}>Actividad reciente</h3>
      <button type="button" onClick={onViewOrders}
        className="inline-flex min-h-10 items-center gap-2 rounded-[10px] px-2 text-[12px] font-medium text-central-orange focus-visible:outline-2 focus-visible:outline-central-orange">
        Ver mis pedidos <ArrowRight size={15}/>
      </button>
    </div>
    {recent.length === 0 ?
      <div className={`mt-5 border-t py-10 ${border}`}>
        <Package size={25} className="text-central-orange"/>
        <p className={`mt-4 text-[13px] font-medium ${primary}`}>Todavía no tenés pedidos vinculados.</p>
        <p className={`mt-2 text-[12px] leading-6 ${muted}`}>Cuando hagas un pedido con tu cuenta, podrás consultar su actividad acá. No incorporamos compras de invitados solo por compartir teléfono.</p>
      </div> :
      <div className={`mt-3 divide-y ${dark ? 'divide-white/10' : 'divide-neutral-200'}`}>
        {recent.map(order => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className={`text-[13px] font-medium ${primary}`}>Pedido {order.code}</p>
            <p className={`mt-1 text-[11px] ${muted}`}>
              {new Date(order.createdAt).toLocaleDateString('es-AR')} · {order.status}
            </p>
          </div>
          <span className={`text-[13px] font-semibold tabular-nums ${primary}`}>{money(Number(order.total))}</span>
        </div>)}
      </div>}
  </section>;
}
