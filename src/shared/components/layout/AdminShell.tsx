'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { AdminNotifications } from './AdminNotifications';
import { useEffect, useState } from 'react';
import { ADMIN_NAVIGATION } from '@/shared/constants/navigation';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/utils/cn';
import { getAdminSession, logoutAdmin, type AdminSession } from '@/features/auth/services/auth.service';
import { BurgerLoader } from '@/shared/components/ui/BurgerLoader';
import { useAnimatedPresence } from '@/shared/hooks/useAnimatedPresence';

const ADMIN_NAV_GROUPS = [
  { label: 'Resumen', items: ADMIN_NAVIGATION.slice(0, 1) },
  { label: 'Catálogo', items: ADMIN_NAVIGATION.slice(1, 5) },
  { label: 'Operación', items: ADMIN_NAVIGATION.slice(5, 8) },
  { label: 'Administración', items: ADMIN_NAVIGATION.slice(8, 11) },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMounted = useAnimatedPresence(mobileOpen);
  const [checked, setChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    let active = true;

    getAdminSession()
      .then((currentSession) => {
        if (!active) return;
        if (!currentSession) {
          router.replace(ROUTES.adminLogin);
          return;
        }
        setSession(currentSession);
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
      <div className="grid min-h-screen place-items-center bg-central-carbon px-5 text-white">
        <div className="max-w-lg rounded-sm border border-red-400/30 bg-red-500/10 p-5 text-center text-sm text-red-100">
          {authError}
        </div>
      </div>
    );
  }

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-central-carbon">
        <BurgerLoader />
      </div>
    );
  }

  const displayName = session?.name?.trim() || session?.email?.split('@')[0] || 'Administrador';
  const displayEmail = session?.email || 'Sin email';
  const avatarInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AD';

  const sidebar = (
    <aside className="flex h-full flex-col overflow-hidden bg-[#191b20] text-white">
      <div className="px-4 pb-5 pt-5">
        <div className="flex min-w-0 items-center gap-3 rounded-sm px-2 py-1.5">
          <div className="relative shrink-0">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-central-orange to-central-ember text-sm font-black text-white shadow-[0_8px_22px_rgba(228,87,18,.18)]">
              {avatarInitials}
            </span>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#191b20] bg-emerald-500" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black leading-tight text-white">{displayName}</p>
            <p className="mt-0.5 truncate text-[11px] text-white/45">{displayEmail}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/[.07] px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-white/45">
            Admin
          </span>
        </div>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[.14em] text-white/30">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'group flex min-h-10 items-center gap-3 rounded-sm px-3 py-2 text-[13px] font-bold transition',
                      item.development
                        ? 'border border-red-500/35 bg-red-500/10 text-red-300 hover:border-red-400/65 hover:bg-red-500/20 hover:text-red-200'
                        : 'text-white/65 hover:bg-white/10 hover:text-white',
                      active && !item.development && 'bg-central-orange text-white shadow-orange',
                      active && item.development && 'border-red-400 bg-red-500/25 text-red-100 shadow-[0_12px_30px_rgba(239,68,68,.14)]',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-sm transition-colors',
                        active && !item.development
                          ? 'bg-white/15 text-white'
                          : item.development
                            ? 'bg-red-500/10 text-red-300'
                            : 'bg-white/[.06] text-white/55 group-hover:bg-white/10 group-hover:text-white',
                      )}
                    >
                      <Icon size={15.5} strokeWidth={2.1} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.development ? (
                      <span className="rounded-sm border border-red-400/50 bg-red-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-red-300">
                        Dev
                      </span>
                    ) : active ? (
                      <ChevronRight size={13} className="text-white/70" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className="flex min-h-10 w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-[13px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          <span className="grid h-7 w-7 place-items-center rounded-sm bg-white/[.06]">
            <LogOut size={15} />
          </span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <div className="admin-scope min-h-screen bg-[#f5f5f5] text-central-carbon">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[250px] lg:block">{sidebar}</div>

      {mobileMounted ? (
        <div data-state={mobileOpen ? 'open' : 'closed'} aria-hidden={!mobileOpen} className={cn("lcb-admin-mobile-overlay fixed inset-0 z-50 bg-black/60 lg:hidden", !mobileOpen && "pointer-events-none")} onClick={() => setMobileOpen(false)}>
          <div className="lcb-admin-mobile-panel h-full w-[min(290px,86vw)]" onClick={(event) => event.stopPropagation()}>{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-neutral-200/55 bg-[#f5f5f5]/65 px-4 backdrop-blur-[5px] sm:h-[76px] sm:px-6">
          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-neutral-200/80 bg-white/45 text-neutral-700 transition-[background-color,border-color] duration-200 hover:border-central-orange/30 hover:bg-white/70 lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Abrir navegación">
            {mobileOpen ? <X /> : <Menu />}
          </button>
          <div className="ml-auto flex items-center gap-3">
            <AdminNotifications />
            <Link href={ROUTES.menu} className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-[11px] bg-central-orange/10 px-4 py-2 text-[12px] font-semibold text-central-ember transition-[background-color,color,transform] duration-200 hover:bg-central-orange hover:text-white active:scale-[.98]">Ver sitio</Link>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
