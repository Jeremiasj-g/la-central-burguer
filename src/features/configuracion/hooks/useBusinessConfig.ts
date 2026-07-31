'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { BusinessConfig } from '../types/configuracion.types';
import {
  getBusinessConfig,
  subscribeToBusinessConfig,
  updateBusinessConfig,
} from '../services/configuracion.service';

export function useBusinessConfig() {
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setConfig(await getBusinessConfig());
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'No se pudo cargar la configuración del negocio.';
      setError(message);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function update(input: Partial<BusinessConfig>, options?: { silent?: boolean }) {
    try {
      const next = await updateBusinessConfig(input);
      setConfig(next);
      setError(null);
      if (!options?.silent) toast.success('Configuración actualizada correctamente.');
      return next;
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'No se pudo guardar la configuración.';
      setError(message);
      toast.error(message);
      throw err;
    }
  }

  useEffect(() => {
    refresh();
    return subscribeToBusinessConfig(refresh);
  }, [refresh]);

  return { config, isLoading, error, refresh, update };
}
