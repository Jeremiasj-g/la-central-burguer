export function getSafeModalMaxHeight(offset = 32) {
  if (typeof window === 'undefined') return 'calc(100dvh - 2rem)';
  const safeBottom = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0', 10) || 0;
  return `${Math.max(window.innerHeight - offset - safeBottom, 320)}px`;
}
