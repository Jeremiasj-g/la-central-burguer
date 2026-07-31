const BUSINESS_TIME_ZONE = 'America/Argentina/Cordoba';

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface DashboardPeriodLabels {
  last7Days: string;
  last30Days: string;
}

function getCalendarDateInTimeZone(date: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function toUtcCalendarDate({ year, month, day }: CalendarDate) {
  return new Date(Date.UTC(year, month - 1, day));
}

function subtractCalendarDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

function formatCalendarDate(date: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function buildPeriodLabel(days: number, today: Date) {
  const startDate = subtractCalendarDays(today, days - 1);
  const range = `del ${formatCalendarDate(startDate)} al ${formatCalendarDate(today)}`;

  return `Período analizado: ${range} (últimos ${days} días). No incluye pedidos cancelados.`;
}

export function getDashboardPeriodLabels(referenceDate = new Date()): DashboardPeriodLabels {
  const today = toUtcCalendarDate(
    getCalendarDateInTimeZone(referenceDate, BUSINESS_TIME_ZONE),
  );

  return {
    last7Days: buildPeriodLabel(7, today),
    last30Days: buildPeriodLabel(30, today),
  };
}
