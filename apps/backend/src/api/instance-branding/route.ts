import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { toInstanceBrandingPayload } from './branding';
import { readInstanceBranding } from './read';

/**
 * GET /instance-branding — qué instalación es ésta. PÚBLICA, sin auth y sin
 * publishable key.
 *
 * ── Por qué es top-level y no `/store` ni `/admin` ───────────────────────────────
 *
 * El login del admin la consume ANTES de autenticarse, así que no puede vivir bajo
 * `/admin`. Y tampoco bajo `/store`: Medusa monta `ensurePublishableApiKeyMiddleware`
 * sobre TODO el namespace `/store` (`framework/dist/http/router.js:98`) y rechaza sin
 * el header, que pre-login no existe. Por eso NO se reusa la ruta que ya sirve esta
 * misma marca al storefront (`/store/sites/main/config`), aunque el dato sea el mismo.
 * Mismo lugar y misma razón que `src/api/favicon.ico`.
 *
 * Expone SÓLO marca pública —nombre, logo, color—: exactamente lo que ya se ve
 * entrando al storefront. Nada de configuración, conteos ni ids.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Corto a propósito: es marca editable desde el admin y una pestaña abierta tiene
  // que ver el cambio sin esperar. No hay nada caro detrás.
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json(toInstanceBrandingPayload(await readInstanceBranding(req.scope)));
}
