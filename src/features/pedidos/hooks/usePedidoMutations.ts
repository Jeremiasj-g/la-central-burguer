'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { OrderStatus } from '../types/pedido.types';
import { cancelPedido, updatePedidoStatus } from '../services/pedidos.service';

export function usePedidoMutations(onSuccess?: () => void) {
  const [isSaving, setIsSaving] = useState(false);

  async function run<T>(action: () => Promise<T>, successMessage: string) {
    setIsSaving(true);
    try {
      const result = await action();
      onSuccess?.();
      toast.success(successMessage);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el pedido.';
      toast.error(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isSaving,
    updateStatus: (id: string, status: OrderStatus) => run(() => updatePedidoStatus(id, status), 'Pedido actualizado correctamente.'),
    cancel: (id: string) => run(() => cancelPedido(id), 'Pedido cancelado correctamente.'),
  };
}
