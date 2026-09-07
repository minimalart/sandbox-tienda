import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  getRecommendationsConfig,
  RECOMMENDATIONS_DEFAULTS,
  RECOMMENDATIONS_HARD_CAPS,
  STRATEGY_CONFIG_DEFAULTS,
  upsertRecommendationsConfig,
  type RecommendationsConfig,
} from '../../../../modules/recommendations/config';
import { invalidateConfig } from '../../../../modules/recommendations/serve/cache';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, que es el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * GET /admin/recommendations/config — config efectiva (merge sobre defaults).
 *
 * Devuelve también `defaults` y `hard_caps` para que el backoffice pueda mostrar el
 * valor por defecto de cada perilla y el tope al que va a ser recortada, sin
 * duplicar esos números en el front (donde inevitablemente quedarían viejos).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const config = await getRecommendationsConfig(req.scope, await siteOf(req));
  res.status(200).json({
    config,
    defaults: RECOMMENDATIONS_DEFAULTS,
    strategy_defaults: STRATEGY_CONFIG_DEFAULTS,
    hard_caps: RECOMMENDATIONS_HARD_CAPS,
  });
}

/** POST /admin/recommendations/config — persiste un patch parcial. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const patch = req.validatedBody as Partial<RecommendationsConfig>;
  const config = await upsertRecommendationsConfig(req.scope, patch, await siteOf(req));
  // Sin esto el cambio tardaría hasta el TTL del memo en verse en el storefront, y
  // el merchant creería que el guardado no tomó efecto.
  invalidateConfig();
  res.status(200).json({ config });
}
