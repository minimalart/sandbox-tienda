import type { ErpCatalogSyncSettings } from '../types';

/**
 * ¿Este tick del cron tiene que pedir el catálogo COMPLETO (sin `fechasincro`)?
 *
 * Existe porque la condición original era solo `getHours() === full_sweep_hour`, y
 * con `ERP_CATALOG_SYNC_CRON` cada 15 minutos eso daba CUATRO barridos completos
 * por noche (4:00, 4:15, 4:30, 4:45). Son idempotentes, pero cada uno baja el
 * catálogo entero del ERP (~8 MB) y recorre todas las variantes de Medusa: es
 * exactamente el trabajo pesado por el que el cron arranca en 15 minutos y no en 1
 * (ver el incidente de CPU al 100% documentado en `jobs/erp-catalog-sync.ts`).
 *
 * La marca se compara por DÍA CALENDARIO local y no por "hace más de 24 h": lo que
 * se quiere garantizar es "uno por noche", y una ventana de 24 h corrida hace que
 * el barrido se vaya arrastrando de día en día si un tick llega tarde.
 *
 * Es una función pura para poder testear el borde de medianoche y el cambio de
 * horario sin container ni reloj falso: la fecha entra por parámetro.
 */
export function shouldFullSweep(
  settings: Pick<ErpCatalogSyncSettings, 'full_sweep_hour' | 'last_full_sweep_at'> | null | undefined,
  now: Date
): boolean {
  const hour = settings?.full_sweep_hour;
  // `null` apaga el barrido por completo (es la semántica documentada del setting).
  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  if (now.getHours() !== hour) return false;

  const last = settings?.last_full_sweep_at;
  if (!last) return true;
  const parsed = new Date(last);
  // Una marca corrupta no puede dejar el barrido apagado para siempre: ante un
  // valor ilegible se barre, que es el lado seguro (el sync es idempotente).
  if (Number.isNaN(parsed.getTime())) return true;
  return !isSameLocalDay(parsed, now);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
