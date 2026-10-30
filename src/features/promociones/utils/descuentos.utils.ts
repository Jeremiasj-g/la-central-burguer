import type { CategoryDiscountCampaign } from '../types/descuento.types';

// Devuelve la fecha civil del local, sin depender de la zona horaria del cliente.
export function businessDate(now: Date, timeZone = 'America/Argentina/Cordoba') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '00';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function campaignStatus(c: CategoryDiscountCampaign, today: string): 'paused' | 'scheduled' | 'active' | 'finished' {
  if (!c.enabled) return 'paused';
  if (today < c.starts_on) return 'scheduled';
  if (today > c.ends_on) return 'finished';
  return 'active';
}

export function discountForCategory(campaigns: CategoryDiscountCampaign[], categoryId: string, today: string): number {
  return campaigns.reduce((best, c) => c.category_id === categoryId && campaignStatus(c, today) === 'active'
    ? Math.max(best, Number(c.discount_percent))
    : best, 0);
}

export function discountedPrice(base: number, percent: number) {
  // El backend redondea al peso por unidad usando numeric de PostgreSQL.
  return Math.round(Math.max(0, base) * (1 - percent / 100));
}
