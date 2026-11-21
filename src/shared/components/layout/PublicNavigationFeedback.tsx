'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// Feedback only for real cross-page navigations. Hash scrolling and external
// links keep their original behavior from PublicSectionNavigation.
export function PublicNavigationFeedback() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const startedFrom = useRef<string | null>(null);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clear() {
      if (delay.current) clearTimeout(delay.current);
      if (watchdog.current) clearTimeout(watchdog.current);
      delay.current = null;
      watchdog.current = null;
      startedFrom.current = null;
      setVisible(false);
    }

    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;

      let destination: URL;
      try { destination = new URL(anchor.href); } catch { return; }
      if (destination.origin !== window.location.origin) return;
      // Hash navigation is handled by PublicSectionNavigation, with no route loader.
      if (destination.hash || destination.pathname === window.location.pathname) return;

      if (delay.current) clearTimeout(delay.current);
      if (watchdog.current) clearTimeout(watchdog.current);
      startedFrom.current = window.location.pathname;
      delay.current = setTimeout(() => setVisible(true), 140);
      // Never leave a stuck loading overlay if navigation is cancelled.
      watchdog.current = setTimeout(clear, 8000);
    }

    document.addEventListener('click', onClick, true);
    window.addEventListener('pageshow', clear);
    window.addEventListener('popstate', clear);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pageshow', clear);
      window.removeEventListener('popstate', clear);
      if (delay.current) clearTimeout(delay.current);
      if (watchdog.current) clearTimeout(watchdog.current);
    };
  }, []);

  useEffect(() => {
    if (startedFrom.current !== null && pathname !== startedFrom.current) {
      if (delay.current) clearTimeout(delay.current);
      if (watchdog.current) clearTimeout(watchdog.current);
      delay.current = null;
      watchdog.current = null;
      startedFrom.current = null;
      setVisible(false);
    }
  }, [pathname]);

  return <div aria-hidden="true" className={`lcb-navigation-feedback ${visible ? 'is-visible' : ''}`}>
    <div className="lcb-navigation-progress" />
    <div className="lcb-navigation-veil" />
  </div>;
}
