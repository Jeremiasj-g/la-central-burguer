'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { AdminNotifications } from './AdminNotifications';
import { useState } from 'react';
import { ADMIN_NAVIGATION } from '@/shared/constants/navigation';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/utils/cn';
import { logoutAdmin } from '@/features/auth/services/auth.service';
import { useBusinessConfig } from '@/features/configuracion/hooks/useBusinessConfig';
import { BusinessLogo } from '@/features/configuracion/components/BusinessLogo';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { config } = useBusinessConfig();
  const businessWords = (config?.businessName?.trim() || 'La Central Burger').split(/\s+/);
  const businessLastWord = businessWords.pop() || '';
  const businessFirstWords = businessWords.join(' ') || businessLastWord;

  async function handleLogout() {
    await logoutAdmin();
    router.replace(ROUTES.adminLogin);
  }

  const sidebar = (
    <aside className="flex h-full flex-col bg-central-carbon text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-sm bg-central-orange text-white">
          <BusinessLogo logoUrl={config?.logoUrl} businessName={config?.businessName} mode="admin" />
        </span>
        <div>
          <p className="max-w-40 truncate text-base font-black leading-none">{businessFirstWords}</p>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-central-orange">{businessLastWord || 'Admin'} · Admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {ADMIN_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white',
                active && 'bg-central-orange text-white shadow-orange',
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-sm px-4 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white">
          <LogOut size={18} /> Salir
        </button>
      </div>
    </aside>
  );

  return (
    <div className="admin-scope min-h-screen bg-[#f6f4ef] text-central-carbon">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-72" onClick={(event) => event.stopPropagation()}>{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-sm border border-neutral-200 p-2 lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Abrir navegación">
            {mobileOpen ? <X /> : <Menu />}
          </button>
          <div>
            <p className="text-sm font-bold text-neutral-500">Panel de gestión</p>
            <p className="text-lg font-black text-central-carbon">{config?.businessName ?? 'La Central Burger'}</p>
          </div>
          <div className="flex items-center gap-3">
            <AdminNotifications />
            <Link href={ROUTES.menu} className="rounded-sm bg-central-orange/10 px-4 py-2 text-sm font-bold text-central-orange hover:bg-central-orange hover:text-white">Ver sitio</Link>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
