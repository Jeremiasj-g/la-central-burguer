export function isProductImagePlaceholder(imageUrl?: string | null): boolean {
  if (!imageUrl?.trim()) return true;

  const normalized = imageUrl.trim().toLowerCase().split('?')[0].split('#')[0];

  return (
    normalized.includes('/images/productos/') && normalized.endsWith('.svg')
  ) || normalized.includes('placeholder');
}
