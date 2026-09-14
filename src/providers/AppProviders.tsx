'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { AccountOnboardingGuard } from '@/features/auth/components/AccountOnboardingGuard';
import { clearLegacyPersistence } from '@/shared/utils/legacy-storage.utils';
import { recoverOrphanedBodyScrollLock } from '@/shared/utils/body-scroll-lock.utils';

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    clearLegacyPersistence();

    const recoverScroll = () => {
      window.requestAnimationFrame(() => recoverOrphanedBodyScrollLock());
    };

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
      <AccountOnboardingGuard />
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
