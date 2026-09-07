/**
 * geo — helpers GEOGRÁFICOS puros, SIN dependencias (ni DB, ni container, ni
 * ./types). Aislados a propósito en su propio módulo para que sean importables
 * desde tests con `node --test` (strip-types) sin arrastrar la cadena de imports
 * de valores de order-context/types.
 */

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Normaliza un valor lat/lng a number. Acepta number o string parseable.
 * Devuelve null si no es finito.
 */
const toCoordNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * extractLatLng — lee coordenadas de un metadata heterogéneo y las normaliza.
 *
 * El storefront guarda las coords en `shipping_address.metadata` pero con claves
 * inconsistentes según el flujo: a veces `{ lat, lng }`, a veces
 * `{ latitude, longitude }`. Esta función acepta AMBAS (prioriza `lat`/`lng`,
 * cae a `latitude`/`longitude`), parsea string|number → number y VALIDA rango
 * geográfico (lat ∈ [-90,90], lng ∈ [-180,180]). Si falta cualquiera de las dos
 * o están fuera de rango / NaN, devuelve null (función pura, sin side-effects).
 */
export const extractLatLng = (
  metadata: unknown,
): { lat: number; lng: number } | null => {
  if (!isRecord(metadata)) return null;

  const lat = toCoordNumber(metadata.lat ?? metadata.latitude);
  const lng = toCoordNumber(metadata.lng ?? metadata.longitude);

  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
};
