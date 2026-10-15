'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps an overlay mounted during its 200 ms exit animation.
 * When reduced motion is enabled, it unmounts immediately.
 */
export function useAnimatedPresence(open: boolean, duration = 200) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMounted(false);
      return;
    }

    const timeout = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(timeout);
  }, [open, duration]);

  return mounted;
}
