/**
 * Admin notification email resolver — plugin-local shim to avoid coupling to
 * the host's `email-templates` extension.
 *
 * Priority ladder mirrors the host's `getAdminNotificationEmail` but degrades
 * gracefully when the base modules are not present:
 *
 *   1. Host's `store_config` module (via container) if registered — returns
 *      the per-site `admin_notification_email` set in Email branding.
 *   2. env `MERCATTO_ADMIN_NOTIFICATION_EMAIL` — instance-wide fallback.
 *   3. env `ADMIN_EMAIL` — legacy fallback used across Mercatto.
 *   4. `null` — no recipient. Callers should treat this as "skip send".
 *
 * ── POR QUÉ ESTO RECIBE UNA TIENDA (2026-09-03) ──────────────────────────────
 *
 * Este shim llamaba `getEmailBranding()` SIN ARGUMENTOS. Del otro lado,
 * `readSetting(key, undefined)` saltea la fila de la tienda y devuelve la
 * GLOBAL, así que el aviso de un contacto nuevo iba siempre a la casilla global
 * — aunque la pantalla que la configura (`admin/store-config/email-branding`)
 * guarde por tienda y aunque la instalación tenga UNA sola.
 *
 * Medido en desdeelsur, que es mono-tienda y tiene las dos filas cargadas:
 *
 *   order-notification-admin    → info@desdelsur.com.ar  (fila de `demo_main`)
 *   contact-notification-admin  → la casilla de la fila GLOBAL
 *
 * Dos avisos internos de la MISMA tienda a dos buzones distintos. Y ojo con el
 * diagnóstico fácil: esto NO pasaba por `modules/email/admin-recipient.ts` del
 * host —el formulario de contacto vive en este plugin y nunca lo tocó—, así que
 * arreglar sólo aquel archivo dejaba el caso medido intacto.
 *
 * La tienda la resuelve el CALL SITE, no este archivo: la ruta ya la tiene (la
 * saca de la publishable key para sellar `submission.site_id`) y volver a
 * resolverla acá sería una consulta de más y una segunda fuente de verdad.
 */
import type { MedusaContainer } from '@medusajs/framework/types';

const STORE_CONFIG_KEYS = ['store_config', 'storeConfig'] as const;

type StoreConfigService = {
  /**
   * `siteId` es OPCIONAL en el host y resuelve PRECEDENCIA (fila de la tienda si
   * existe, global si no), no filtrado. Por eso pasarlo sólo puede AGREGAR un
   * candidato: una instalación sin branding por tienda lee la misma fila global
   * que leía antes.
   */
  getEmailBranding(siteId?: string | null): Promise<{ admin_notification_email?: string | null }>;
};

function envFallback(): string | null {
  const value =
    process.env.MERCATTO_ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tryResolveStoreConfig(container: MedusaContainer): StoreConfigService | null {
  for (const key of STORE_CONFIG_KEYS) {
    try {
      const service = container.resolve<StoreConfigService>(key);
      if (service && typeof service.getEmailBranding === 'function') return service;
    } catch {
      // key not registered, try next
    }
  }
  return null;
}

/**
 * @param siteId  La tienda del mensaje, o `null` para la fila global. `null` es
 *                la respuesta CORRECTA en una instalación multitienda sin eje:
 *                elegir una mandaría el aviso de la tienda B al buzón de la A y
 *                el mail ya salió, no se puede deshacer.
 */
export async function resolveAdminNotificationEmail(
  container: MedusaContainer,
  siteId: string | null = null,
): Promise<string | null> {
  const service = tryResolveStoreConfig(container);
  if (!service) return envFallback();
  try {
    const branding = await service.getEmailBranding(siteId);
    return branding.admin_notification_email || envFallback();
  } catch {
    return envFallback();
  }
}
