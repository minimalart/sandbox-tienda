// Adaptadores string <-> Date para el <DatePicker> de Medusa (@medusajs/ui),
// cuyo value/onChange son `Date | null`. Los forms del admin guardan las fechas
// como strings (datetime-local `YYYY-MM-DDTHH:mm` u `YYYY-MM-DD`) y convierten en
// el submit; estos helpers convierten SOLO en el borde del DatePicker, sin tocar
// esa lógica ni la semántica de zona horaria.

const pad = (n: number) => String(n).padStart(2, '0');

/** datetime-local string (hora local) -> Date. Vacío/ inválido -> null. */
export function localInputToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // `YYYY-MM-DDTHH:mm` lo interpreta el motor como hora local (igual que el
  // input nativo datetime-local), así que no hay corrimiento de zona horaria.
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date -> datetime-local string (hora local, sin segundos). null -> ''. */
export function dateToLocalInput(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** date-only string `YYYY-MM-DD` (hora local) -> Date a medianoche local. */
export function dateOnlyToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  // Construir con componentes locales evita que `new Date("YYYY-MM-DD")` (UTC)
  // corra el día hacia atrás en zonas con offset negativo (ej. AR, UTC-3).
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date -> date-only string `YYYY-MM-DD` (hora local). null -> ''. */
export function dateToDateOnly(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
