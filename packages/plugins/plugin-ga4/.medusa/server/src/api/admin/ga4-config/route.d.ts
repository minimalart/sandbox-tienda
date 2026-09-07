import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * GET /admin/ga4-config — devuelve la config GA4 EFECTIVA (app-settings, con la
 * fila legacy `ga4_settings` como override por campo) para mostrar el estado de
 * envío en el backoffice. Solo IDs públicos + flags; NUNCA el api_secret.
 *
 * Los campos se editan desde la card de app-settings, no desde acá.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/**
 * POST /admin/ga4-config — guarda la configuración de la tienda de la request.
 *
 * Escribe en `ga4_settings` con `site_id`, que desde multitienda es la fuente de
 * verdad de esta extensión. `updateSettings` clona la fila global heredada en
 * vez de pisarla: guardar desde una tienda no puede cambiarle la propiedad de
 * GA4 a todas las demás.
 *
 * El api_secret sólo se escribe si llega un string no vacío; vacío u omitido
 * preserva el guardado, igual que antes.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
