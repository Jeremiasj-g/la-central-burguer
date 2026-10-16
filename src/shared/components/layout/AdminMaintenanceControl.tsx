'use client';
import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';

export function AdminMaintenanceControl() {
  const { config, isLoading, update } = useBusinessConfig();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const enabled = Boolean(config?.maintenanceMode);

  async function toggleMaintenance() {
    if (!config || isSaving) return;
    setIsSaving(true);
    try {
      await update({ maintenanceMode: !enabled }, { silent: true });
      toast.success(enabled ? 'El sitio volvió a su estado habitual.' : 'Modo mantenimiento activado.');
      setConfirmOpen(false);
    } catch {
      // El hook ya informa el error; no cambiamos el estado si falla.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isLoading || !config || isSaving}
        aria-label={enabled ? 'Finalizar mantenimiento' : 'Activar mantenimiento'}
        aria-pressed={enabled}
        title={enabled ? 'Finalizar mantenimiento' : 'Activar mantenimiento'}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border px-3 text-[12px] font-medium transition-[background-color,border-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-central-orange/25 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? 'border-central-orange/35 bg-central-orange/10 text-central-ember hover:bg-central-orange/15' : 'border-neutral-200/80 bg-white/50 text-neutral-600 hover:border-central-orange/30 hover:bg-white/75'}`}
      >
        <Wrench size={15} strokeWidth={1.8} />
        <span className="hidden sm:inline">{enabled ? 'En mantenimiento' : 'Mantenimiento'}</span>
        {enabled ? <span className="h-1.5 w-1.5 rounded-full bg-central-orange" aria-hidden="true" /> : null}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title={enabled ? 'Finalizar mantenimiento' : 'Activar mantenimiento'}
        description={enabled
          ? 'El sitio volverá a recibir pedidos cuando el local esté abierto según su horario.'
          : 'El menú quedará visible pero bloqueado. Los clientes no podrán agregar productos ni enviar pedidos hasta que finalices el mantenimiento.'}
        confirmLabel={enabled ? 'Finalizar mantenimiento' : 'Activar mantenimiento'}
        theme="light"
        isLoading={isSaving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={toggleMaintenance}
      />
    </>
  );
}
