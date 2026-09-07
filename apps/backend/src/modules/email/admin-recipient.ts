import type { MedusaContainer } from '@medusajs/framework/types';
import { resolveSite } from '../../lib/multistore/resolve-site';
import type { SiteHint } from '../../lib/multistore/types';
import { STORE_CONFIG_MODULE } from '../store-config';
import type StoreConfigModuleService from '../store-config/service';
import { getEmailTemplateSettings } from './settings';

/**
 * Resolves the email address that should receive admin notifications.
 *
 * Priority:
 *   1. The `admin_notification_email` configured in the email branding settings.
 *   2. `ADMIN_EMAIL` resolved through `app-settings` (DB row > env > default).
 *   3. `null` (no recipient configured).
 *
 * Any failure resolving the store-config module (e.g. module unavailable) falls
 * back to `ADMIN_EMAIL` — a misconfigured branding row must never break sends.
 *
 * The two layers are NOT redundant: `admin_notification_email` is per-store
 * branding (it carries `site_id`), while `ADMIN_EMAIL` is the instance-wide
 * fallback for every store that didn't set its own.
 *
 * ── POR QUÉ ESTE HELPER RECIBE UNA `SiteHint` Y NO UN `siteId` ────────────────
 *
 * Los emisores de la copia interna llegan con ejes DISTINTOS:
 * `order-placed-email` y `company-created-email` tienen el `sales_channel_id` de
 * la orden / de la empresa, `corporate-created-email` tiene el `site_id` propio
 * de la fila (`corporate` no cuelga de un canal), y el handoff de WhatsApp
 * (`ai-assistant/.../whatsapp-tools.ts`) NO TIENE NINGUNO: una conversación
 * derivada a un humano no cuelga de una orden ni de una empresa. Pedir un
 * `siteId` obligaría a cada uno a traducir el canal por su cuenta, y pasar un
 * canal donde va un id de tienda NO falla: `readSetting` no encuentra la fila y
 * cae a la global, o sea el bug que esto viene a cerrar, pero ahora con código
 * que parece migrado. `resolveSite` ya traduce, y gratis resuelve el caso B2B
 * —matchea las DOS columnas de canal—, que un `WHERE sales_channel_id = ?` a
 * mano se pierde. El caso sin pista lo cubre `siteOfNotification`, abajo.
 */
const fallbackRecipient = (): string | null => getEmailTemplateSettings().adminEmail || null;

/**
 * La tienda del aviso, o `null` para la fila GLOBAL.
 *
 * ── EL BUG QUE ESTE CAMBIO CIERRA ────────────────────────────────────────────
 *
 * Antes esto empezaba con `if (!hint) return null;` y sólo aceptaba
 * `status === 'site'`. Consecuencia medida en desdeelsur (2026-09-03), que es
 * MONO-TIENDA —una sola fila viva en el registro— y tiene las DOS filas de
 * `email_branding`: la global con una casilla y la de `demo_main` con otra:
 *
 *   order-notification-admin  → info@desdelsur.com.ar      (fila de demo_main)
 *   whatsapp-handoff-admin    → la global, otra casilla
 *
 * El primero llega con `salesChannelId` y resuelve a `site`. El segundo
 * (`ai-assistant/.../whatsapp-tools.ts`) llama SIN pista porque un handoff de
 * WhatsApp no tiene orden ni empresa de dónde sacarla, y con `hint` indefinido
 * esto devolvía `null` → `readSetting(key, null)` saltea la fila de la tienda →
 * gana la global. Dos avisos internos de la MISMA tienda a dos casillas, y el
 * operador sólo mira una.
 *
 * ── POR QUÉ AHORA TAMBIÉN VALE `singleSite` ──────────────────────────────────
 *
 * Es el mismo criterio, y por el mismo motivo, que `implicitSiteId()` en
 * `service.ts`: con UNA sola fila en el registro, "de qué tienda es este aviso"
 * no tiene otra respuesta posible. `singleSite` es el estado que el seam ya
 * define para eso (`lib/multistore/types.ts`).
 *
 * Y acá el efecto es literalmente AMPLIAR, no restringir: `readSetting` resuelve
 * PRECEDENCIA —la fila de la tienda si existe, la global si no—, así que pasar un
 * `siteId` sólo agrega un candidato. Una instalación mono-tienda que nunca
 * configuró branding por tienda sigue leyendo exactamente la misma fila global
 * que antes.
 *
 * ── POR QUÉ CON VARIAS TIENDAS SIGUE SIENDO `null`, Y ESO NO ES DEUDA ────────
 *
 * `allSites` cae a `null` a propósito. Elegir una tienda cuando hay varias
 * mandaría el aviso de la tienda B al buzón del operador de la A, y no hay señal
 * de que pasó: el mail YA SALIÓ, no se puede deshacer. Por eso tampoco se pasa
 * `allowMainFallback` —caer a la `is_main` es exactamente esa adivinanza—, la
 * misma línea que `email/service.ts` no cruza y que `request.ts` prohíbe en el
 * admin. El arreglo del caso multitienda es aguas arriba: que el emisor declare
 * su tienda.
 *
 * `unknownSite` también cae en `null`: pidieron una tienda que no existe, y
 * abortar un aviso interno por una fila stale del registro sería peor que
 * mandarlo a la casilla global.
 *
 * Un fallo del registro degrada a `null` (global) y NO a `fallbackRecipient()`:
 * quedarse sin poder resolver la tienda no puede además tirar a la basura el
 * `admin_notification_email` que la instalación sí tiene configurado.
 */
async function siteOfNotification(
  container: MedusaContainer,
  hint: SiteHint | undefined,
): Promise<string | null> {
  try {
    // Hint VACÍO y no un early return: sin pistas, `resolveSite` devuelve
    // `singleSite` con una fila y `allSites` con dos o más. Es la pregunta que hay
    // que hacer, escrita con el vocabulario del seam y sin SQL propio — el nombre
    // de la tabla vive en `lib/multistore/module-key.ts` y es el único literal.
    const resolution = await resolveSite(container, hint ?? {});
    if (resolution.status === 'site' || resolution.status === 'singleSite') {
      return resolution.site.id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getAdminNotificationEmail(
  container: MedusaContainer,
  hint?: SiteHint,
): Promise<string | null> {
  try {
    const service: StoreConfigModuleService = container.resolve(STORE_CONFIG_MODULE);
    const siteId = await siteOfNotification(container, hint);
    const { admin_notification_email } = await service.getEmailBranding(siteId);
    return admin_notification_email || fallbackRecipient();
  } catch {
    return fallbackRecipient();
  }
}
