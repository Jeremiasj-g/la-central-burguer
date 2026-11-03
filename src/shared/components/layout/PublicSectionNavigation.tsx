'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Los enlaces del sitio público conservan sus href accesibles y compartibles,
// pero la navegación interna no deja hashes en la URL ni depende de hashchange.
const HOME_SECTION_IDS = new Set(['inicio', 'menu', 'mas-vendidos', 'especialidades', 'productos', 'carta']);
type PendingSection = { pathname: string; id: string };

function scrollToSection(id: string): boolean {
  const section = document.getElementById(id);
  if (!section) return false;

  const header = document.querySelector<HTMLElement>('header.sticky');
  const headerHeight = header?.getBoundingClientRect().height ?? 0;
  const targetTop = window.scrollY + section.getBoundingClientRect().top - headerHeight - 8;

  window.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
  return true;
}

function removeHashFromAddress(): void {
  if (!window.location.hash) return;
  // Conserva el estado de Next.js y cualquier parámetro de búsqueda.
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search,
  );
}

export function PublicSectionNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const pendingSection = useRef<PendingSection | null>(null);

  // Capturamos los clicks de enlaces internos de todas las secciones del sitio,
  // incluido el navbar, hero, menú y footer. No afecta links externos ni modales.
  useEffect(() => {
    function handleInternalClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      const source = event.target;
      if (!(source instanceof Element)) return;
      const anchor = source.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;

      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      // "Inicio" debe volver arriba incluso cuando ya estamos en la portada.
      if (!destination.hash && destination.pathname === '/' && window.location.pathname === '/' && destination.search === window.location.search) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'auto' });
        removeHashFromAddress();
        return;
      }
      if (!destination.hash || destination.hash === '#') return;

      let id: string;
      try {
        id = decodeURIComponent(destination.hash.slice(1));
      } catch {
        return;
      }
      if (!id) return;

      let nextPath = destination.pathname;
      // Los enlaces antiguos "#menu" desde /menu también apuntan al inicio.
      if (href.startsWith('#') && !document.getElementById(id) && HOME_SECTION_IDS.has(id)) {
        nextPath = '/';
      }

      const samePage = nextPath === window.location.pathname && destination.search === window.location.search;
      if (samePage) {
        if (!scrollToSection(id)) return;
        event.preventDefault();
        removeHashFromAddress();
        return;
      }

      event.preventDefault();
      pendingSection.current = { pathname: nextPath, id };
      router.push(nextPath + destination.search, { scroll: false });
    }

    document.addEventListener('click', handleInternalClick, true);
    return () => document.removeEventListener('click', handleInternalClick, true);
  }, [router]);

  // Al navegar entre páginas, esperamos a que Next monte el destino. También
  // respetamos enlaces directos con #sección y limpiamos la barra después.
  useEffect(() => {
    const pending = pendingSection.current;
    if (pending && pending.pathname !== pathname) return;

    const id = pending?.id ?? (() => {
      const hash = window.location.hash;
      if (!hash || hash === '#') return null;
      try { return decodeURIComponent(hash.slice(1)); } catch { return null; }
    })();

    if (!id) return;

    let frame = 0;
    let attempts = 0;
    const tryScroll = () => {
      if (scrollToSection(id)) {
        pendingSection.current = null;
        removeHashFromAddress();
        return;
      }
      if (++attempts < 120) {
        frame = window.requestAnimationFrame(tryScroll);
      } else {
        pendingSection.current = null;
      }
    };
    frame = window.requestAnimationFrame(tryScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
