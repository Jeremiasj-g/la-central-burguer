'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { clearLegacyPersistence } from '@/shared/utils/legacy-storage.utils';
import { recoverOrphanedBodyScrollLock } from '@/shared/utils/body-scroll-lock.utils';

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    clearLegacyPersistence();

    const recoverScroll = () => {
      window.requestAnimationFrame(() => recoverOrphanedBodyScrollLock());
    };

    // Limpia cualquier bloqueo huérfano dejado por una recarga en caliente,
    // una navegación del historial o un cierre inesperado de un overlay.
    recoverScroll();
    window.addEventListener('pageshow', recoverScroll);
    window.addEventListener('popstate', recoverScroll);
    document.addEventListener('visibilitychange', recoverScroll);

    return () => {
      window.removeEventListener('pageshow', recoverScroll);
      window.removeEventListener('popstate', recoverScroll);
      document.removeEventListener('visibilitychange', recoverScroll);
    };
  }, []);

  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={2600}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastClassName="!rounded-sm"
      />
    </>
  );
}
