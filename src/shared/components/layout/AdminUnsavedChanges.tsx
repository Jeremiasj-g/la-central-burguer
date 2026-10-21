'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';

type NavigationGuard = { setDirty: (value: boolean) => void; requestNavigation: (action: () => void) => void };
const GuardContext = createContext<NavigationGuard | null>(null);

export function AdminUnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const listener = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);
  const requestNavigation = useCallback((action: () => void) => {
    if (!dirty) { action(); return; }
    setPending(() => action);
  }, [dirty]);
  const discard = () => {
    const action = pending;
    setPending(null);
    setDirty(false);
    action?.();
  };
  return (
    <GuardContext.Provider value={{ setDirty, requestNavigation }}>
      {children}
      <ConfirmDialog
        open={Boolean(pending)} title="Cambios sin guardar" theme="light" tone="danger"
        description="Tenés modificaciones pendientes. Si salís ahora, se perderán los cambios no guardados."
        confirmLabel="Salir sin guardar" cancelLabel="Seguir editando"
        onConfirm={discard} onCancel={() => setPending(null)}
      />
    </GuardContext.Provider>
  );
}

export function useAdminUnsavedChanges(dirty: boolean) {
  const guard = useContext(GuardContext);
  if (!guard) throw new Error('No se encontró AdminUnsavedChangesProvider');
  const { setDirty } = guard;
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  return guard.requestNavigation;
}
export function useGuardedNavigation() {
  const guard = useContext(GuardContext);
  if (!guard) throw new Error('No se encontró AdminUnsavedChangesProvider');
  return guard.requestNavigation;
}
