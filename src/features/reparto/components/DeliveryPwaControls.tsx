'use client';

import { Bell, CheckCircle2, Download, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  enableDeliveryPushNotifications,
  getDeliveryPushStatus,
  registerDeliveryServiceWorker,
  supportsDeliveryPush,
  testDeliveryPushNotification,
} from '../services/delivery-driver.service';

type PushStatus = 'checking' | 'unsupported' | 'denied' | 'disabled' | 'enabled';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function standaloneMode() {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function DeliveryPwaControls() {
  const [pushStatus, setPushStatus] = useState<PushStatus>('checking');
  const [pushBusy, setPushBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    let active = true;

    setInstalled(standaloneMode());
    setIsIos(isIosDevice());

    void registerDeliveryServiceWorker()
      .then(() => getDeliveryPushStatus())
      .then((status) => {
        if (active) setPushStatus(status);
      })
      .catch(() => {
        if (active) setPushStatus(supportsDeliveryPush() ? 'disabled' : 'unsupported');
      });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      toast.success('La Central Delivery quedó instalada.');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function handleEnablePush() {
    if (isIos && !installed) {
      toast.info('En iPhone primero instalá la app: Safari → Compartir → Añadir a pantalla de inicio.');
      return;
    }

    setPushBusy(true);
    try {
      await enableDeliveryPushNotifications();
      setPushStatus('enabled');

      const test = await testDeliveryPushNotification();
      if (test.sent > 0) {
        toast.success('Notificaciones activadas y prueba enviada al teléfono.');
      } else if (test.subscriptionCount === 0) {
        toast.warning('Se activó el permiso, pero el dispositivo no quedó suscripto. Probá nuevamente.');
      } else {
        toast.warning(test.firstError
          ? `Se activaron, pero el envío de prueba falló: ${test.firstError}`
          : 'Se activaron, pero el servidor no pudo enviar la prueba.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.';
      toast.error(message);
      setPushStatus(await getDeliveryPushStatus().catch(() => 'disabled'));
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestPush() {
    setPushBusy(true);
    try {
      const result = await testDeliveryPushNotification();
      if (result.sent > 0) {
        toast.success('Prueba enviada. Debería aparecer como notificación del sistema.');
      } else if (result.subscriptionCount === 0) {
        setPushStatus('disabled');
        toast.warning('Este dispositivo ya no tiene una suscripción push activa. Activala nuevamente.');
      } else {
        toast.error(result.firstError
          ? `El proveedor rechazó la notificación: ${result.firstError}`
          : 'No se pudo enviar la notificación de prueba.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo probar la notificación.');
    } finally {
      setPushBusy(false);
    }
  }

  async function handleInstall() {
    if (installed) return;

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setInstallPrompt(null);
      }
      return;
    }

    if (isIos) {
      toast.info('En Safari tocá Compartir y elegí “Añadir a pantalla de inicio”.');
      return;
    }

    toast.info('Abrí el menú del navegador y elegí “Instalar app” o “Agregar a pantalla principal”.');
  }

  return (
    <section className="mb-6 overflow-hidden rounded-[24px] border border-black/[0.045] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025),0_10px_28px_rgba(0,0,0,0.025)]">
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[#FFF5E8] text-[#FF9500]">
          <Smartphone size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.015em] text-[#1C1C1E]">App de reparto</p>
          <p className="mt-1 text-[12px] leading-5 text-[#8E8E93]">
            Instalá el acceso directo y activá avisos para recibir nuevos pedidos aunque no tengas el panel abierto.
          </p>
        </div>
      </div>

      <div className="grid border-t border-[#E5E5EA] sm:grid-cols-2 sm:divide-x sm:divide-[#E5E5EA]">
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installed}
          className="flex min-h-14 cursor-pointer items-center justify-between gap-3 border-b border-[#E5E5EA] px-5 text-left transition active:bg-[#F2F2F7] disabled:cursor-default sm:border-b-0"
        >
          <span className="flex items-center gap-2.5">
            {installed ? <CheckCircle2 size={17} className="text-[#34C759]" /> : <Download size={17} className="text-[#007AFF]" />}
            <span>
              <span className="block text-[13px] font-medium text-[#1C1C1E]">{installed ? 'App instalada' : 'Instalar acceso directo'}</span>
              <span className="mt-0.5 block text-[10px] text-[#8E8E93]">{installed ? 'Se abre como una app' : 'Sin escribir la URL'}</span>
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => void (pushStatus === 'enabled' ? handleTestPush() : handleEnablePush())}
          disabled={pushBusy || pushStatus === 'unsupported'}
          className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 text-left transition active:bg-[#F2F2F7] disabled:cursor-default"
        >
          <span className="flex items-center gap-2.5">
            {pushStatus === 'enabled'
              ? <CheckCircle2 size={17} className="text-[#34C759]" />
              : <Bell size={17} className={pushStatus === 'denied' ? 'text-[#FF3B30]' : 'text-[#FF9500]'} />}
            <span>
              <span className="block text-[13px] font-medium text-[#1C1C1E]">
                {pushStatus === 'checking' && 'Comprobando avisos…'}
                {pushStatus === 'enabled' && (pushBusy ? 'Enviando prueba…' : 'Probar notificación')}
                {pushStatus === 'disabled' && (pushBusy ? 'Activando…' : 'Activar notificaciones')}
                {pushStatus === 'denied' && 'Notificaciones bloqueadas'}
                {pushStatus === 'unsupported' && 'No disponible en este navegador'}
              </span>
              <span className="mt-0.5 block text-[10px] text-[#8E8E93]">
                {pushStatus === 'enabled' ? 'Envía un aviso de prueba a este teléfono' : 'Preview del pedido en el teléfono'}
              </span>
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
