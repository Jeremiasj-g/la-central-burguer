'use client';

import { BellRing, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  enableAdminPush, getAdminPushStatus, isIosAdminPushWithoutApp,
  testAdminPush, type AdminPushStatus,
} from '@/features/pedidos/services/admin-push.service';

export function AdminPushControls() {
  const [status, setStatus] = useState<AdminPushStatus | 'checking'>('checking');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    void getAdminPushStatus().then((next) => {
      if (mounted) setStatus(next);
    }).catch(() => {
      if (mounted) setStatus('disabled');
    });
    return () => { mounted = false; };
  }, []);

  async function handleClick() {
    if (busy || status === 'checking') return;
    if (isIosAdminPushWithoutApp()) {
      toast.info('En Safari primero instalá la app: Compartir → Añadir a pantalla de inicio.');
      return;
    }
    if (status === 'denied') {
      toast.info('Habilitá las notificaciones desde los permisos del navegador o del sistema.');
      return;
    }
    if (status === 'unsupported') {
      toast.info('Este navegador no admite Push. Probá desde la app instalada o Chrome.');
      return;
    }

    setBusy(true);
    try {
      if (status === 'enabled') {
        const result = await testAdminPush();
        if ((result.sent ?? 0) > 0) toast.success('Prueba enviada a tu dispositivo.');
        else if ((result.subscriptionCount ?? 0) === 0) {
          setStatus('disabled');
          toast.warning('Tu dispositivo no figura suscripto. Activá los avisos otra vez.');
        } else toast.error(result.firstError || 'No se pudo enviar la prueba.');
      } else {
        await enableAdminPush();
        setStatus('enabled');
        const test = await testAdminPush();
        if ((test.sent ?? 0) > 0) toast.success('Avisos activados. Te enviamos una prueba.');
        else toast.info('Avisos activados. Cuando llegue un pedido nuevo, recibirás una notificación.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.');
      setStatus(await getAdminPushStatus().catch(() => 'disabled'));
    } finally {
      setBusy(false);
    }
  }

  const enabled = status === 'enabled';
  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy || status === 'checking'}
      title={enabled ? 'Enviar una notificación de prueba' : 'Activar avisos de pedidos nuevos'}
      className="flex min-h-10 w-full items-center gap-3 rounded-[11px] px-3 py-2 text-left text-[13px] font-medium text-white/65 transition-[background-color,color] duration-200 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-60"
    >
      <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-white/[.07]">
        {busy || status === 'checking'
          ? <LoaderCircle size={16} className="animate-spin" />
          : enabled ? <CheckCircle2 size={16} className="text-emerald-400" />
          : <BellRing size={16} strokeWidth={1.8} className="text-central-orange"/>}
      </span>
      <span className="flex-1">
        <span className="block">{busy ? 'Preparando avisos…' : enabled ? 'Probar notificación' : 'Activar avisos'}</span>
        {status === 'denied' ? <span className="block text-[10px] text-red-300">Permiso bloqueado</span> : null}
        {status === 'unsupported' ? <span className="block text-[10px] text-white/45">Requiere navegador compatible</span> : null}
      </span>
      {enabled ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" /> : null}
    </button>
  );
}
