'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface AnimatedValueProps {
  value: number;
  formatter?: (value: number) => string;
  duration?: number;
  className?: string;
}

interface AnimatedFormattedValueProps {
  value: string;
  duration?: number;
  className?: string;
}

const defaultFormatter = (value: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(value));

function parseFormattedValue(input: string) {
  const match = input.match(/-?[\d.,]+/);
  if (!match || match.index === undefined) return null;

  const token = match[0];
  const prefix = input.slice(0, match.index);
  const suffix = input.slice(match.index + token.length);
  const commaParts = token.split(',');
  const dotParts = token.split('.');
  const hasComma = commaParts.length > 1;
  const hasDot = dotParts.length > 1;
  let decimalSeparator: ',' | '.' | null = null;

  if (hasComma && hasDot) {
    decimalSeparator = token.lastIndexOf(',') > token.lastIndexOf('.') ? ',' : '.';
  } else if (hasComma) {
    const lastPart = commaParts.at(-1) ?? '';
    decimalSeparator = commaParts.length === 2 && lastPart.length > 0 && lastPart.length <= 2 ? ',' : null;
  } else if (hasDot) {
    const lastPart = dotParts.at(-1) ?? '';
    decimalSeparator = dotParts.length === 2 && lastPart.length > 0 && lastPart.length <= 2 ? '.' : null;
  }

  const fractionDigits = decimalSeparator ? (token.split(decimalSeparator).at(-1)?.length ?? 0) : 0;
  let normalized = token;

  if (decimalSeparator === ',') {
    normalized = token.replace(/\./g, '').replace(',', '.');
  } else if (decimalSeparator === '.') {
    normalized = token.replace(/,/g, '');
  } else {
    normalized = token.replace(/[.,]/g, '');
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return null;

  return { numericValue, prefix, suffix, fractionDigits };
}

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

export function AnimatedFormattedValue({ value, duration = 850, className }: AnimatedFormattedValueProps) {
  const parsed = useMemo(() => parseFormattedValue(value), [value]);

  if (!parsed) return <span className={className}>{value}</span>;

  const formatter = (current: number) => {
    const formattedNumber = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: parsed.fractionDigits,
      maximumFractionDigits: parsed.fractionDigits,
    }).format(current);

    return `${parsed.prefix}${formattedNumber}${parsed.suffix}`;
  };

  return <AnimatedValue value={parsed.numericValue} formatter={formatter} duration={duration} className={className} />;
}
