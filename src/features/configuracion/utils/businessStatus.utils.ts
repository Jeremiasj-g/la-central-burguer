import type { BusinessConfig } from '../types/configuracion.types';

export const BUSINESS_WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const DAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function local(date: Date, zone: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: zone || 'America/Argentina/Cordoba',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (name: string) => p.find(x => x.type === name)?.value ?? '';
  return { day: DAY[part('weekday')] ?? 0, minute: Number(part('hour')) * 60 + Number(part('minute')) };
}
function mins(time: string) { const [h='0',m='0']=time.split(':'); return Number(h)*60+Number(m); }
export function businessWeekday(date: Date, timezone: string) { return local(date,timezone).day; }
export function businessHoursForDay(config: BusinessConfig, day: number) {
  return config.dailyHours?.[String(day)] ?? { open: config.autoOpenTime, close: config.autoCloseTime };
}
export function isBusinessOpenBySchedule(config: BusinessConfig, at = new Date()) {
  if (config.maintenanceMode) return false;
  const { day, minute } = local(at, config.timezone);
  if (config.closedWeekdays?.includes(day)) return false;
  if (!config.autoScheduleEnabled) return config.isOpen;
  const today = businessHoursForDay(config, day);
  const open = mins(today.open), close = mins(today.close);
  if (open < close && minute >= open && minute < close) return true;
  if (open > close && minute >= open) return true;
  const yesterday = (day + 6) % 7;
  if (config.closedWeekdays?.includes(yesterday)) return false;
  const prev = businessHoursForDay(config, yesterday);
  return mins(prev.open) > mins(prev.close) && minute < mins(prev.close);
}
export function getBusinessStatusLabel(config: BusinessConfig, at = new Date()) {
  if (config.maintenanceMode) return 'Mantenimiento';
  return isBusinessOpenBySchedule(config,at) ? 'Abierto ahora' : 'Cerrado ahora';
}
export function getNextBusinessOpening(config: BusinessConfig, at = new Date()) {
  if (!config.autoScheduleEnabled || config.maintenanceMode || isBusinessOpenBySchedule(config,at)) return null;
  const point = new Date(Math.floor(at.getTime()/60000)*60000 + 60000);
  for (let i=0;i<8*1440;i++) {
    if (isBusinessOpenBySchedule(config,point)) return point;
    point.setTime(point.getTime()+60000);
  }
  return null;
}
export function getTodayBusinessHours(config: BusinessConfig, at = new Date()) {
  const day=businessWeekday(at,config.timezone);
  if(config.closedWeekdays?.includes(day)) return 'Cerrado';
  const hours=businessHoursForDay(config,day);
  return hours.open+' a '+hours.close;
}
