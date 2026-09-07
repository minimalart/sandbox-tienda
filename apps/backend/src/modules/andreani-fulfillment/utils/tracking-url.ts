/**
 * URL pública de seguimiento de Andreani (fuente única).
 *
 * Es la página de cara al cliente ya usada como canónica en el repo
 * (ver `workflows/transition-delivery-execution.ts`). Centralizarla acá evita
 * que las dos rutas de proyección de tracking diverjan.
 *
 * Devuelve `undefined` cuando el tracking está vacío/espacios o es un
 * placeholder `PENDING-*` (no hay un envío real todavía).
 */
export function buildAndreaniTrackingUrl(
  trackingNumber?: string | null
): string | undefined {
  const code = (trackingNumber ?? '').trim();
  if (!code) return undefined;
  if (code.toUpperCase().startsWith('PENDING-')) return undefined;
  return `https://www.andreani.com/seguimiento?codigo=${code}`;
}
