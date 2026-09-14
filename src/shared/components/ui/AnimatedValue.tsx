'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedValueProps {
  value: number;
  formatter?: (value: number) => string;
  duration?: number;
  className?: string;
}

const defaultFormatter = (value: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(value));

export function AnimatedValue({
  value,
  formatter = defaultFormatter,
  duration = 850,
  className,
}: AnimatedValueProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState(0);
  const displayRef = useRef(0);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startValue = hasMountedRef.current ? displayRef.current : 0;
    const endValue = safeValue;
    hasMountedRef.current = true;

    if (reducedMotion || duration <= 0 || startValue === endValue) {
      displayRef.current = endValue;
      setDisplayValue(endValue);
      return;
    }

    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (endValue - startValue) * eased;

      displayRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        displayRef.current = endValue;
        setDisplayValue(endValue);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, safeValue]);

  return (
    <span className={className} aria-label={formatter(safeValue)}>
      {formatter(displayValue)}
    </span>
  );
}
