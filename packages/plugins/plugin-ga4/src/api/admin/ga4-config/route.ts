import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../lib/multistore/request';
import { GA4_MODULE } from '../../../modules/ga4';
import type Ga4ModuleService from '../../../modules/ga4/service';

/** `null` = la fila GLOBAL, el fallback de toda tienda sin configuración propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

type Ga4ConfigResponse = {
  measurement_id: string | null;
  gtm_id: string | null;
  api_secret_set: boolean;
  debug: boolean;
};

/** Serializa la fila de settings a la respuesta pública: NUNCA devuelve el
 * api_secret, solo el flag api_secret_set. */
function toResponse(settings: {
  measurement_id: string | null;
  gtm_id: string | null;
  api_secret: string | null;
  debug: boolean;
}): Ga4ConfigResponse {
  return {
    measurement_id: settings.measurement_id ?? null,
    gtm_id: settings.gtm_id ?? null,
    api_secret_set: Boolean(settings.api_secret),
    debug: Boolean(settings.debug),
  };
}

/**
 * GET /admin/ga4-config — devuelve la config GA4 EFECTIVA (app-settings, con la
 * fila legacy `ga4_settings` como override por campo) para mostrar el estado de
 * envío en el backoffice. Solo IDs públicos + flags; NUNCA el api_secret.
 *
 * Los campos se editan desde la card de app-settings, no desde acá.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ga4Service = req.scope.resolve<Ga4ModuleService>(GA4_MODULE);
  const settings = await ga4Service.getSettings(await siteOf(req));
  res.status(200).json(toResponse(settings));
}

type Ga4ConfigBody = {
  measurement_id?: string | null;
  gtm_id?: string | null;
  debug?: boolean;
  api_secret?: string;
};

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
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ga4Service = req.scope.resolve<Ga4ModuleService>(GA4_MODULE);
  const body = (req.body ?? {}) as Ga4ConfigBody;

  const patch: Record<string, unknown> = {};

  if (body.measurement_id !== undefined) {
    patch.measurement_id = body.measurement_id?.trim() || null;
  }
  if (body.gtm_id !== undefined) {
    patch.gtm_id = body.gtm_id?.trim() || null;
  }
  if (body.debug !== undefined) {
    patch.debug = Boolean(body.debug);
  }
  if (typeof body.api_secret === 'string' && body.api_secret.trim()) {
    patch.api_secret = body.api_secret.trim();
  }

  const settings = await ga4Service.updateSettings(patch, await siteOf(req));
  res.status(200).json(toResponse(settings));
}
