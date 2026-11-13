export type LocalizedNumberKind = 'money' | 'decimal' | 'integer';

/**
 * Convierte texto escrito por personas a número sin perder el separador decimal.
 * - money: 26.000,50 / 26,50 / 26.50 / 0.9
 * - decimal: 0,9 / 0.9 / 64,64 / 64.64 (hasta la precisión indicada)
 * - integer: cantidades, orden y contadores enteros
 *
 * `undefined` significa campo vacío/transitorio; `null` es texto inválido.
 */
export function parseLocalizedNumber(
  text: string,
  kind: LocalizedNumberKind = 'decimal',
  maxDecimals = kind === 'money' ? 2 : kind === 'integer' ? 0 : 4,
): number | undefined | null {
  const cleaned = text.trim().replace(/[\s\u00a0\u202f]/g, '').replace(/^\$/, '');
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.' || cleaned === '-,' || cleaned === '-.') return undefined;
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;

  if (kind === 'integer') {
    if (!/^-?\d+$/.test(cleaned)) return null;
    const value = Number(cleaned);
    return Number.isSafeInteger(value) ? value : null;
  }

  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const comma = unsigned.lastIndexOf(',');
  const dot = unsigned.lastIndexOf('.');
  let normalized = unsigned;

  if (comma !== -1 && dot !== -1) {
    // El último separador es decimal; los anteriores sólo pueden ser miles.
    const decimalSeparator = comma > dot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const parts = unsigned.split(decimalSeparator);
    if (parts.length !== 2) return null;
    const thousands = thousandsSeparator === '.' ? /\./g : /,/g;
    const intPart = parts[0];
    if (intPart.includes(thousandsSeparator) && !new RegExp('^\\d{1,3}(\\' + thousandsSeparator + '\\d{3})+$').test(intPart)) return null;
    normalized = intPart.replace(thousands, '') + '.' + parts[1];
  } else if (comma !== -1) {
    if (unsigned.indexOf(',') !== comma) return null;
    normalized = unsigned.replace(',', '.');
  } else if (dot !== -1) {
    if (kind === 'money' && /^\d{1,3}(\.\d{3})+$/.test(unsigned) && !unsigned.startsWith('0.')) {
      normalized = unsigned.replace(/\./g, '');
    } else if (unsigned.indexOf('.') !== dot) {
      // Para dinero, varios puntos sólo son válidos si son separadores de miles.
      return null;
    }
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const decimalDigits = normalized.split('.')[1]?.length ?? 0;
  if (decimalDigits > maxDecimals) return null;
  const value = Number((negative ? '-' : '') + normalized);
  return Number.isFinite(value) ? value : null;
}

export function displayLocalizedNumber(
  value: number | null | undefined,
  kind: LocalizedNumberKind = 'decimal',
  zeroAsEmpty = true,
): string {
  if (value === null || value === undefined || !Number.isFinite(value) || (zeroAsEmpty && value === 0)) return '';
  if (kind === 'money') return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  if (kind === 'integer') return String(value);
  return String(value).replace('.', ',');
}
