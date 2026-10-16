'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type PublicTheme = 'dark' | 'light';
type ThemeContextValue = { theme: PublicTheme; toggleTheme: () => void };
const PublicThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'lcb-public-theme';

export function PublicThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<PublicTheme>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
      else if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
    } catch { /* La preferencia sigue disponible durante esta sesión. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const scope = document.querySelector<HTMLElement>('.public-site');
    scope?.setAttribute('data-public-theme', theme);
    document.body.setAttribute('data-public-theme', theme);
    if (hydrated) {
      try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* Almacenamiento opcional. */ }
    }
    return () => { document.body.removeAttribute('data-public-theme'); };
  }, [theme, hydrated]);

  return (
    <PublicThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((value) => value === 'dark' ? 'light' : 'dark') }}>
      {children}
    </PublicThemeContext.Provider>
  );
}

export function PublicThemeSwitch() {
  const context = useContext(PublicThemeContext);
  if (!context) return null;
  const isDark = context.theme === 'dark';
  return (
    <button type="button" className="lcb-theme-switch" onClick={context.toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}>
      {isDark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
      <span className="hidden xl:inline">{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  );
}

export function usePublicTheme(): PublicTheme {
  return useContext(PublicThemeContext)?.theme ?? 'dark';
}
