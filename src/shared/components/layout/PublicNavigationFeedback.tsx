'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type NavigationPhase = 'idle' | 'loading' | 'complete';

// One shared indicator for real cross-page navigation. Hash-only movement,
// external links and unrelated actions never trigger the global overlay.
export function PublicNavigationFeedback() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<NavigationPhase>('idle');
  const [cycle, setCycle] = useState(0);
  const startedFrom = useRef<string | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completion = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clear() {
      if (watchdog.current) clearTimeout(watchdog.current);
      if (completion.current) clearTimeout(completion.current);
      watchdog.current = null;
      completion.current = null;
      startedFrom.current = null;
      setPhase('idle');
    }

    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;

      let destination: URL;
      try { destination = new URL(anchor.href); } catch { return; }
      if (destination.origin !== window.location.origin) return;
      // Hash-only and same-path changes do not load a different page.
      if (destination.pathname === window.location.pathname) return;

      if (watchdog.current) clearTimeout(watchdog.current);
      if (completion.current) clearTimeout(completion.current);
      completion.current = null;
      startedFrom.current = window.location.pathname;
      // Restart the fill and shimmer on every new navigation, including rapid clicks.
      setCycle(current => current + 1);
      setPhase('loading');
      // A failed or cancelled navigation cannot leave the screen dimmed forever.
      watchdog.current = setTimeout(clear, 30000);
    }

    document.addEventListener('click', onClick, true);
    window.addEventListener('pageshow', clear);
    window.addEventListener('popstate', clear);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pageshow', clear);
      window.removeEventListener('popstate', clear);
      if (watchdog.current) clearTimeout(watchdog.current);
      if (completion.current) clearTimeout(completion.current);
    };
  }, []);

  useEffect(() => {
    if (startedFrom.current !== null && pathname !== startedFrom.current) {
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = null;
      startedFrom.current = null;
      setPhase('complete');
      if (completion.current) clearTimeout(completion.current);
      completion.current = setTimeout(() => {
        completion.current = null;
        setPhase('idle');
      }, 220);
    }
  }, [pathname]);

  return (
    <div aria-hidden="true" className={`lcb-navigation-feedback ${phase === 'idle' ? '' : `is-visible is-${phase}`}`}>
      <div className="lcb-navigation-progress" key={cycle} />
      <div className="lcb-navigation-veil" />
    </div>
  );
}
