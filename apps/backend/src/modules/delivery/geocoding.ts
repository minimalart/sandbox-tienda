/**
 * geocoding — geocoding de RESPALDO para resolver coords de una dirección cuando
 * el storefront no las capturó (shipping_address.metadata sin lat/lng).
 *
 * Usa la Google Geocoding API vía `fetch` NATIVO (Node 20+) — sin dependencias
 * nuevas. Es defensivo y best-effort: ante AUSENCIA de API key, error de red,
 * respuesta no-OK, ZERO_RESULTS o payload inesperado devuelve `null` SIN lanzar,
 * para nunca romper el flujo de create-delivery-execution.
 *
 * REQUISITO DE INFRA: la key (GOOGLE_MAPS_API_KEY, o como fallback
 * VITE_GOOGLE_MAPS_API_KEY) DEBE tener habilitada la "Geocoding API" en el
 * proyecto de Google Cloud. Sin esa API habilitada la request responde
 * REQUEST_DENIED y esta función devuelve null (geocoding deshabilitado de facto).
 *
 * DE DÓNDE SALE LA KEY: de `./settings.ts`, que aplica la precedencia
 * **DB > env > default** de `app-settings`. Los dos nombres de env siguen siendo
 * los mismos y en el mismo orden — el descriptor los declara como alias
 * (`env: ['GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY']`) —, así que una
 * instalación que no toque nada se comporta igual que antes.
 */

import { getGoogleMapsApiKey } from './settings';

export interface GeocodableAddress {
  address_1?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
}

interface GeocodeOptions {
  /** Override explícito de la key (tests / DI). Si falta, sale de `settings.ts`. */
  apiKey?: string;
  /** Logger opcional; si no se pasa, usa console.warn para el caso sin key. */
  logger?: { warn: (msg: string) => void };
}

/** Compone "address_1, city, province, postal_code, country_code" omitiendo vacíos. */
const composeAddress = (address: GeocodableAddress): string => {
  const parts = [
    address.address_1,
    address.city,
    address.province,
    address.postal_code,
    address.country_code,
  ]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);
  return parts.join(', ');
};

const resolveApiKey = (opts?: GeocodeOptions): string | undefined => {
  const fromOpts =
    typeof opts?.apiKey === 'string' && opts.apiKey.trim().length > 0
      ? opts.apiKey.trim()
      : undefined;
  if (fromOpts) return fromOpts;

  // La cascada de las dos env vars ahora vive en el descriptor, en el mismo
  // orden. `getGoogleMapsApiKey()` devuelve '' cuando no hay ninguna; se traduce
  // a `undefined` porque es lo que el resto de esta función espera para tomar la
  // rama "geocoding skipped".
  const configured = getGoogleMapsApiKey();
  return configured === '' ? undefined : configured;
};

/**
 * geocodeAddress — resuelve { lat, lng } para una dirección, o null.
 *
 * @param address campos de la dirección (los vacíos se omiten al componer).
 * @param opts.apiKey override de la key; opts.logger logger opcional.
 */
export const geocodeAddress = async (
  address: GeocodableAddress,
  opts?: GeocodeOptions,
): Promise<{ lat: number; lng: number } | null> => {
  const apiKey = resolveApiKey(opts);
  if (!apiKey) {
    const msg = 'geocoding skipped: no API key';
    if (opts?.logger) opts.logger.warn(msg);
    else console.warn(msg);
    return null;
  }

  const query = composeAddress(address);
  if (!query) return null;

  try {
    const url =
      'https://maps.googleapis.com/maps/api/geocode/json' +
      `?address=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const body = (await res.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: { lat?: unknown; lng?: unknown } } }>;
    };

    if (body.status !== 'OK') return null;

    const location = body.results?.[0]?.geometry?.location;
    const lat = typeof location?.lat === 'number' ? location.lat : Number(location?.lat);
    const lng = typeof location?.lng === 'number' ? location.lng : Number(location?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return { lat, lng };
  } catch {
    // Error de red / parseo: best-effort, no rompemos el flujo.
    return null;
  }
};

export default geocodeAddress;
