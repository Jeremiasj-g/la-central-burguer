'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { PedidosTable } from '../components/PedidosTable';
import { PedidosTableSkeleton } from '../components/PedidosTableSkeleton';
import { usePedidoMutations } from '../hooks/usePedidoMutations';
import { usePedidos } from '../hooks/usePedidos';
import type { OrderStatus } from '../types/pedido.types';
import { AdminPageHeader } from '@/shared/components/layout/AdminPageHeader';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { EmptyState } from '@/shared/components/ui/EmptyState';

const adminInputClass = '!bg-white !text-central-carbon !placeholder:text-neutral-500 border-neutral-200';
const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'aceptado', label: 'Aceptados' },
  { value: 'cancelado', label: 'Cancelados' },
] as const;

export function PedidosAdminPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const { pedidos, isLoading, error, refresh } = usePedidos({ search, status });
  const mutations = usePedidoMutations(refresh);

  async function confirmCancelOrder() {
    if (!pendingCancelId) return;
    await mutations.cancel(pendingCancelId);
    setPendingCancelId(null);
  }

  return (
    <div>
      <AdminPageHeader eyebrow="Pedidos" title="Gestión de pedidos" description="Los pedidos que entran desde el sitio quedan aceptados. Si el cliente cancela por WhatsApp, marcá el pedido como cancelado." />
      <div className="mb-6 grid gap-3 rounded-sm border border-neutral-200 bg-white p-4 shadow-soft md:grid-cols-[1fr_240px]">
        <label className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <Input className={`pl-11 ${adminInputClass}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por pedido, cliente o teléfono" />
        </label>
        <Select
          aria-label="Filtrar pedidos por estado"
          variant="light"
          value={status}
          options={STATUS_OPTIONS}
          onValueChange={(nextStatus) => setStatus(nextStatus as 'all' | OrderStatus)}
        />
      </div>
      {error ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <PedidosTableSkeleton />
      ) : pedidos.length > 0 ? (
        <PedidosTable orders={pedidos} onCancelOrder={setPendingCancelId} />
      ) : (
        <EmptyState
          title="Todavía no hay pedidos"
          description="Los pedidos confirmados desde el sitio aparecerán acá automáticamente."
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingCancelId)}
        title="Cancelar pedido"
        description="¿Seguro que querés marcar este pedido como cancelado? Usá esta acción solo si el cliente canceló por WhatsApp."
        confirmLabel="Marcar cancelado"
        tone="danger"
        isLoading={mutations.isSaving}
        onCancel={() => setPendingCancelId(null)}
        onConfirm={confirmCancelOrder}
      />
    </div>
  );
}
