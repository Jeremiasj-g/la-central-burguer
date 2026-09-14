'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { AdminNotifications } from './AdminNotifications';
import { useEffect, useState } from 'react';
import { ADMIN_NAVIGATION } from '@/shared/constants/navigation';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/utils/cn';
import { logoutAdmin, isAdminLoggedIn } from '@/features/auth/services/auth.service';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { config } = useBusinessConfig();
  const businessName = config?.businessName?.trim() || 'La Central Burger';

  useEffect(() => {
    let active = true;

    isAdminLoggedIn()
      .then((loggedIn) => {
        if (!active) return;
        if (!loggedIn) {
          router.replace(ROUTES.adminLogin);
          return;
        }
        setChecked(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : 'No se pudo validar la sesión.');
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    await logoutAdmin();
    router.replace(ROUTES.adminLogin);
  }

  if (authError) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F2F2F7] px-5 text-[#1C1C1E]">
        <div className="max-w-lg rounded-[22px] border border-[#FF3B30]/15 bg-white p-5 text-center text-sm text-[#C9342B] shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          {authError}
        </div>
      </div>
    );
  }

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F2F2F7] text-[14px] font-medium text-[#8E8E93]">
        Cargando panel...
      </div>
    );
  }

  const sidebar = (
    <aside className="flex h-full flex-col bg-[#11100F] text-white">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.045] p-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#FF9500] text-white shadow-[0_8px_24px_rgba(255,149,0,0.18)]">
            <BusinessLogo logoUrl={config?.logoUrl} businessName={config?.businessName} mode="admin" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.015em] text-white">{businessName}</p>
            <p className="mt-0.5 text-[11px] font-medium text-white/45">Panel administrativo</p>
          </div>
        </div>
      </div>

      <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/30">Administración</p>
        {ADMIN_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[14px] font-medium text-white/58 transition-[background-color,color,transform] duration-200 hover:bg-white/[0.07] hover:text-white active:scale-[0.985]',
                active && 'bg-[#FF9500]/15 font-semibold text-[#FFB340]',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/[0.055] text-white/42 transition-colors',
                  active && 'bg-[#FF9500]/15 text-[#FF9500]',
                )}
              >
                <Icon size={17} strokeWidth={2} />
              </span>
              <span className="truncate">{item.label}</span>
              {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FF9500]" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[14px] font-medium text-[#FF6961] transition hover:bg-[#FF3B30]/10 active:scale-[0.985]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#FF3B30]/10">
            <LogOut size={17} />
          </span>
          Salir
        </button>
      </div>
    </aside>
  );

  return (
    <div className="admin-scope min-h-screen bg-[#F2F2F7] text-[#1C1C1E]">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-black/10 bg-[#11100F] lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="h-full w-[min(86vw,304px)] overflow-hidden rounded-r-[28px] bg-[#11100F] shadow-[18px_0_60px_rgba(0,0,0,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-black/[0.05] bg-white/78 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/72">
          <div className="mx-auto flex h-[68px] max-w-[1680px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F2F2F7] text-[#1C1C1E] transition active:scale-95 lg:hidden"
                onClick={() => setMobileOpen((value) => !value)}
                aria-label="Abrir navegación"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#8E8E93]">Panel de gestión</p>
                <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[#1C1C1E]">{businessName}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <AdminNotifications />
              <Link
                href={ROUTES.menu}
                className="inline-flex h-10 items-center rounded-full bg-[#FFF3E0] px-4 text-[13px] font-semibold text-[#C86E00] transition hover:bg-[#FFE7C2] active:scale-[0.98]"
              >
                Ver sitio
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-8 xl:p-9">{children}</main>
      </div>
    </div>
  );
}
