'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { VentasTable } from '../components/VentasTable';
import { useSales } from '../hooks/useSales';
import type { DeliveryMethod, PaymentMethodType } from '@/features/checkout/types/checkout.types';

const DELIVERY_OPTIONS = [
  { value: 'all', label: 'Todas las entregas' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'retiro_local', label: 'Retiro local' },
] as const;

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'Todos los pagos' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
] as const;

const adminInputClass = '!border-neutral-200 !bg-white !text-central-carbon !placeholder:text-neutral-400';

export function VentasAdminPage() {
  const [search, setSearch] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'all' | DeliveryMethod>('all');
  const [paymentMethod, setPaymentMethod] = useState<'all' | PaymentMethodType>('all');
  const { sales, isLoading, error } = useSales({ search, deliveryMethod, paymentMethod });

  return (
    <div>
      <AdminPageHeader eyebrow="Ventas" title="Registro de ventas" description="Pedidos no cancelados registrados en el sistema." />
      <div className="mb-5 grid gap-3 rounded-sm border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pedido o cliente" className={`pl-10 ${adminInputClass}`} />
        </div>
        <Select
          aria-label="Filtrar ventas por entrega"
          variant="light"
          value={deliveryMethod}
          options={DELIVERY_OPTIONS}
          onValueChange={(method) => setDeliveryMethod(method as 'all' | DeliveryMethod)}
        />
        <Select
          aria-label="Filtrar ventas por pago"
          variant="light"
          value={paymentMethod}
          options={PAYMENT_OPTIONS}
          onValueChange={(method) => setPaymentMethod(method as 'all' | PaymentMethodType)}
        />
      </div>
      {error ? (
        <div className="rounded-sm bg-red-50 p-4 text-red-700">{error}</div>
      ) : isLoading ? (
        <div className="rounded-sm border border-neutral-200 bg-white p-10 text-center text-neutral-500">Cargando ventas...</div>
      ) : sales.length ? (
        <VentasTable sales={sales} />
      ) : (
        <EmptyState title="Todavía no hay ventas" description="Los pedidos aceptados aparecerán en este registro." />
      )}
    </div>
  );
}
