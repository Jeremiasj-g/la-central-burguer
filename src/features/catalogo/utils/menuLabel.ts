/**
 * Solo cambia cómo se muestra un nombre en el menú; no modifica la categoría
 * registrada en Supabase ni los valores que utilizan los filtros.
 */
export function formatMenuLabel(value: string): string {
  const text = value.trim().toLocaleLowerCase('es-AR');
  return text.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('es-AR'));
}
