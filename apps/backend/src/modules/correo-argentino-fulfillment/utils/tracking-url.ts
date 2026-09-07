/**
 * URL pública de seguimiento de Correo Argentino (fuente única).
 *
 * Mismo rol que `andreani-fulfillment/utils/tracking-url.ts`: centralizarla acá
 * evita que el subscriber de WhatsApp, la proyección de tracking y el
 * storefront terminen con tres URLs distintas.
 *
 * A diferencia de Andreani NO hay que filtrar placeholders `PENDING-*`: el
 * provider de Correo no los inventa (`tracking_number` queda `null` hasta que
 * el workflow crea el envío de verdad).
 */
import { getCorreoOperationSettings } from '../settings';

/** Default cuando no hay `CORREO_ARGENTINO_TRACKING_BASE_URL`. */
export const CORREO_DEFAULT_TRACKING_BASE_URL =
  'https://www.correoargentino.com.ar/formularios/e-commerce';

/**
 * Base de la URL pública de seguimiento, con override por entorno.
 *
 * Es una PÁGINA WEB, no una API: si Correo la mueve, el síntoma es un link roto
 * en un WhatsApp o en el detalle de la orden, no un checkout caído. Igual va por
 * entorno porque Correo ya cambió sus URLs (el changelog del manual documenta
 * "Inclusión versión en la URL" y "URL PROD y TEST exteriorizadas"), y un link
 * roto no debería necesitar un deploy.
 *
 * Se le saca el `/` final para que el `?id=` no quede detrás de un doble slash.
 * Si el valor no arranca con `http://` o `https://` se ignora y se usa el
 * default: media URL mal pegada en un `.env` produce un link inútil, y es mejor
 * el link conocido que uno roto.
 */
export function resolveCorreoTrackingBaseUrl(env?: {
  CORREO_ARGENTINO_TRACKING_BASE_URL?: string;
}): string {
  // Sin argumento se lee la configuración EFECTIVA de la instancia (base → env →
  // default). Con argumento se lee ese record y nada más: es la forma pura, la que
  // usan los tests y la que deja el resolver auditable sin snapshot.
  const raw = (
    env
      ? env.CORREO_ARGENTINO_TRACKING_BASE_URL
      : getCorreoOperationSettings().trackingBaseUrl
  )?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return CORREO_DEFAULT_TRACKING_BASE_URL;
  }
  return raw.replace(/\/+$/, '');
}

export function buildCorreoTrackingUrl(
  trackingNumber?: string | null,
  baseUrl: string = resolveCorreoTrackingBaseUrl()
): string | undefined {
  const code = (trackingNumber ?? '').trim();
  if (!code) return undefined;
  return `${baseUrl}?id=${encodeURIComponent(code)}`;
}
