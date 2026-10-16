'use client';
import { useEffect, type ReactNode } from 'react';
import { Wrench } from 'lucide-react';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';

export function PublicMaintenanceBoundary({ children }: { children: ReactNode }) {
  const { config } = useBusinessConfig();
  const maintenance = Boolean(config?.maintenanceMode);

  useEffect(() => {
    if (!maintenance) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; };
  }, [maintenance]);

  return (
    <div className="min-h-dvh bg-central-carbon text-central-cream">
      <div inert={maintenance ? true : undefined} aria-hidden={maintenance ? true : undefined}>
        {children}
      </div>
      {maintenance ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0e0c0a]/85 px-5 py-8 text-central-cream backdrop-blur-[7px]" role="status" aria-live="polite">
          <div className="w-full max-w-[420px] rounded-[22px] border border-white/10 bg-[#191b20]/90 px-7 py-9 text-center shadow-[0_24px_90px_rgba(0,0,0,.3)] sm:px-9">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-[17px] border border-central-orange/25 bg-central-orange/10 text-central-orange">
              <Wrench size={25} strokeWidth={1.6} />
            </span>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[.16em] text-central-orange">Mantenimiento</p>
            <h2 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-.04em] text-white sm:text-[27px]">Estamos haciendo algunos ajustes</h2>
            <p className="mt-3 text-[13px] leading-6 text-white/55">Por el momento no estamos tomando pedidos. Volvé a visitarnos en unos minutos.</p>
            <div className="mx-auto mt-6 h-1 w-10 rounded-full bg-central-orange/70" aria-hidden="true" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
