'use client';

import { useEffect, useState } from 'react';

interface ViewportState {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;
  maxHeight: string;
}

function readViewport(offset: number): ViewportState {
  if (typeof window === 'undefined') {
    return {
      height: 720,
      width: 1280,
      offsetTop: 0,
      offsetLeft: 0,
      maxHeight: 'calc(100dvh - 2rem)',
    };
  }

  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  const width = viewport?.width ?? window.innerWidth;
  const offsetTop = viewport?.offsetTop ?? 0;
  const offsetLeft = viewport?.offsetLeft ?? 0;

  return {
    height,
    width,
    offsetTop,
    offsetLeft,
    maxHeight: `${Math.max(height - offset, 260)}px`,
  };
}

export function useSmartModalViewport(offset = 32) {
  const [viewport, setViewport] = useState<ViewportState>(() => readViewport(offset));

  useEffect(() => {
    let frame = 0;

    function calculate() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setViewport(readViewport(offset)));
    }

    calculate();
    window.addEventListener('resize', calculate);
    window.addEventListener('orientationchange', calculate);
    window.visualViewport?.addEventListener('resize', calculate);
    window.visualViewport?.addEventListener('scroll', calculate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', calculate);
      window.removeEventListener('orientationchange', calculate);
      window.visualViewport?.removeEventListener('resize', calculate);
      window.visualViewport?.removeEventListener('scroll', calculate);
    };
  }, [offset]);

  return viewport;
}
