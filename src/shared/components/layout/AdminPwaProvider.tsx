'use client';

import { Download, CheckCircle2 } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

interface AdminPwaState {
  installed: boolean;
  installing: boolean;
  install: () => Promise<void>;
}

const AdminPwaContext = createContext<AdminPwaState | null>(null);

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true;
}

export function AdminPwaProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Este provider vive en /admin/layout, también durante el login.
  // Evita perder beforeinstallprompt cuando el usuario pasa del login al panel.
  useEffect(() => {
    setInstalled(isStandalone());

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    }

    function onInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      toast.success('La Central Admin quedó instalada.');
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // Scope propio: el service worker Push de Delivery usa /delivery/.
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin/' })
        .catch(() => {
          // La web sigue operativa; el navegador puede ofrecer instalación manual.
        });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (installed || installing) return;

    if (installPrompt) {
      setInstalling(true);
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        setInstallPrompt(null);
        if (choice.outcome === 'accepted') {
          // appinstalled confirmará la instalación; no anticipar éxito.
          toast.info('Terminá de instalar La Central Admin desde el navegador.');
        }
      } catch {
        toast.info('Abrí el menú del navegador y elegí «Instalar aplicación».');
      } finally {
        setInstalling(false);
      }
      return;
    }

    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      toast.info('En Safari: tocá Compartir y elegí «Añadir a pantalla de inicio».');
    } else {
      toast.info('En el menú del navegador elegí «Instalar aplicación» o «Agregar a pantalla principal».');
    }
  }

  return (
    <AdminPwaContext.Provider value={{ installed, installing, install }}>
      {children}
    </AdminPwaContext.Provider>
  );
}

export function AdminInstallButton() {
  const pwa = useContext(AdminPwaContext);
  if (!pwa) return null;

  return (
    <button
      type="button"
      onClick={() => void pwa.install()}
      disabled={pwa.installed || pwa.installing}
      title={pwa.installed ? 'Panel instalado' : 'Instalar La Central Admin'}
      className="flex min-h-10 w-full items-center gap-3 rounded-[11px] px-3 py-2 text-left text-[13px] font-medium text-white/65 transition-[background-color,color] duration-200 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-60"
    >
      <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-white/[.07]">
        {pwa.installed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Download size={16} strokeWidth={1.8}/>}
      </span>
      {pwa.installed ? 'Panel instalado' : pwa.installing ? 'Preparando instalación…' : 'Instalar panel'}
    </button>
  );
}
