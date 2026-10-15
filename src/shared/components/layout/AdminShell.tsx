'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { AdminNotifications } from './AdminNotifications';
import { useEffect, useMemo, useState } from 'react';
import { ADMIN_NAVIGATION } from '@/shared/constants/navigation';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/utils/cn';
import { logoutAdmin, isAdminLoggedIn } from '@/features/auth/services/auth.service';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';
import { BurgerLoader } from '@/shared/components/ui/BurgerLoader';

const PRESERVED_ROUTES = new Set([
  ROUTES.adminDashboard,
  ROUTES.adminProductos,
  ROUTES.adminCategorias,
  ROUTES.adminIngredientes,
]);

const NAV_GROUPS = [
  { label: 'Resumen', items: ADMIN_NAVIGATION.slice(0, 1) },
  { label: 'Catálogo', items: ADMIN_NAVIGATION.slice(1, 5) },
  { label: 'Operación', items: ADMIN_NAVIGATION.slice(5, 8) },
  { label: 'Administración', items: ADMIN_NAVIGATION.slice(8, 11) },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { config } = useBusinessConfig();

  const deepRedesign = !PRESERVED_ROUTES.has(pathname as typeof ROUTES.adminDashboard);
  const currentItem = useMemo(
    () => ADMIN_NAVIGATION.find((item) => item.href === pathname),
    [pathname],
  );

  const businessWords = (config?.businessName?.trim() || 'La Central Burger').split(/\s+/);
  const businessLastWord = businessWords.pop() || '';
  const businessFirstWords = businessWords.join(' ') || businessLastWord;

  useEffect(() => {
    document.body.classList.add('admin-apple-mode');
    document.body.classList.toggle('admin-apple-deep', deepRedesign);
    document.body.classList.toggle('admin-apple-preserve', !deepRedesign);

    return () => {
      document.body.classList.remove('admin-apple-mode', 'admin-apple-deep', 'admin-apple-preserve');
    };
  }, [deepRedesign]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
      <div className="grid min-h-screen place-items-center bg-[#f5f5f7] px-5 text-[#1d1d1f]">
        <div className="max-w-lg rounded-[20px] border border-red-200 bg-white p-6 text-center text-sm text-red-600 shadow-[0_12px_40px_rgba(0,0,0,.06)]">
          {authError}
        </div>
      </div>
    );
  }

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f5f7]">
        <BurgerLoader />
      </div>
    );
  }

  const sidebar = (
    <aside className="admin-sidebar flex h-full flex-col overflow-hidden border-r border-black/[.055] bg-white/92 text-[#1d1d1f] backdrop-blur-2xl">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-[#f2f2f7]">
          <BusinessLogo logoUrl={config?.logoUrl} businessName={config?.businessName} mode="admin" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-.015em] text-[#1d1d1f]">{businessFirstWords} {businessLastWord}</p>
          <p className="mt-0.5 text-[11px] font-medium text-[#86868b]">Administración</p>
        </div>
      </div>

      <nav className="admin-nav no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[#a1a1a6]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex min-h-10 items-center gap-3 rounded-[12px] px-3 py-2 text-[13px] font-medium transition-[background-color,color,transform] duration-200',
                      active
                        ? 'bg-[#eaf3ff] text-[#0066cc]'
                        : 'text-[#515154] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]',
                    )}
                  >
                    <span className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-[9px] transition-colors',
                      active
                        ? 'bg-white text-[#0071e3] shadow-[0_1px_3px_rgba(0,0,0,.08)]'
                        : 'bg-[#f5f5f7] text-[#6e6e73] group-hover:bg-white',
                    )}>
                      <Icon size={15.5} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.development ? (
                      <span className="rounded-full bg-[#fff4e5] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.08em] text-[#b35a00]">
                        Beta
                      </span>
                    ) : active ? (
                      <ChevronRight size={13} className="text-[#7eb6ee]" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-black/[.055] p-3">
        <Link
          href={ROUTES.menu}
          className="mb-1 flex min-h-10 items-center gap-3 rounded-[12px] px-3 py-2 text-[13px] font-medium text-[#515154] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#f5f5f7] text-[#6e6e73]">
            <ExternalLink size={15} />
          </span>
          Ver sitio público
        </Link>
        <button
          onClick={handleLogout}
          className="flex min-h-10 w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[13px] font-medium text-[#86868b] transition hover:bg-red-50 hover:text-red-600"
        >
          <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#f5f5f7]">
            <LogOut size={15} />
          </span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <div
      className={cn(
        'admin-scope min-h-screen bg-[#f5f5f7] text-[#1d1d1f]',
        deepRedesign ? 'admin-redesign-deep' : 'admin-redesign-preserve',
      )}
    >
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[250px] lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-[min(290px,86vw)] shadow-[20px_0_60px_rgba(0,0,0,.12)]" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[250px]">
        <header className="admin-topbar sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-black/[.05] bg-[#f5f5f7]/88 px-4 backdrop-blur-2xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-black/[.07] bg-white text-[#515154] shadow-[0_1px_2px_rgba(0,0,0,.04)] lg:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Abrir navegación"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-[#86868b]">Panel de gestión</p>
              <p className="truncate text-[15px] font-semibold tracking-[-.012em] text-[#1d1d1f]">
                {currentItem?.label ?? config?.businessName ?? 'La Central Burger'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AdminNotifications />
            <Link
              href={ROUTES.menu}
              className="hidden h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[12px] font-semibold text-[#515154] shadow-[0_1px_3px_rgba(0,0,0,.08)] ring-1 ring-black/[.045] transition hover:text-[#0071e3] sm:inline-flex"
            >
              Ver sitio <ExternalLink size={13} />
            </Link>
          </div>
        </header>

        <main className={cn(
          'admin-main mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
          deepRedesign ? 'max-w-[1680px]' : 'max-w-[1720px]',
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
