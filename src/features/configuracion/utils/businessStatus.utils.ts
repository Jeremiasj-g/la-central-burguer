import type { BusinessConfig } from '../types/configuracion.types';

function minutesFromTime(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function isBusinessOpenBySchedule(config: BusinessConfig, date = new Date()) {
  if (!config.autoScheduleEnabled) return config.isOpen;

  const now = date.getHours() * 60 + date.getMinutes();
  const open = minutesFromTime(config.autoOpenTime || '20:00');
  const close = minutesFromTime(config.autoCloseTime || '00:00');

  if (open === close) return true;
  if (open < close) return now >= open && now < close;
  return now >= open || now < close;
}

export function getBusinessStatusLabel(config: BusinessConfig) {
  return isBusinessOpenBySchedule(config) ? 'Abierto ahora' : 'Cerrado ahora';
}
