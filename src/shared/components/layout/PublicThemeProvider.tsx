'use client';
// PR temporal: verificación del tema claro público.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export type PublicTheme = 'dark' | 'light';
const STORAGE_KEY = 'lcb-public-theme';
const PublicThemeContext = createContext<{ theme: PublicTheme; toggleTheme: () => void }>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function PublicThemeProvider({ children }: { children: ReactNode }) {
  // Oscuro sigue siendo el aspecto original para quienes todavía no eligieron.
  const [theme, setTheme] = useState<PublicTheme>('dark');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch { /* El selector funciona incluso si el almacenamiento está bloqueado. */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.public-site');
    page?.setAttribute('data-public-theme', theme);
    document.body.setAttribute('data-public-theme', theme);
    if (restored) {
      try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* Preferencia opcional. */ }
    }
    return () => {
      page?.removeAttribute('data-public-theme');
      document.body.removeAttribute('data-public-theme');
    };
  }, [theme, restored]);

  return (
    <PublicThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark') }}>
      {children}
    </PublicThemeContext.Provider>
  );
}

export function usePublicTheme(): PublicTheme {
  return useContext(PublicThemeContext).theme;
}

export function PublicThemeToggle() {
  const { theme, toggleTheme } = useContext(PublicThemeContext);
  const isDark = theme === 'dark';
  return (
    <button type="button" onClick={toggleTheme} className="lcb-theme-toggle"
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      aria-pressed={!isDark}>
      {isDark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
      <span className="hidden lg:inline">{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  );
}
