import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { recommendationsDebugEnabled } from '../../../modules/recommendations/config';
import { recordServed } from '../../../modules/recommendations/events/record';
import { resolveRecommendations } from '../../../modules/recommendations/serve/resolve';
import type { PostStoreRecommendationsInput } from './validators';

/**
 * POST /store/recommendations — recomendaciones para un placement (PRD §15.1).
 *
 * Sin `authenticate`: el storefront pide recomendaciones para visitantes anónimos y
 * la publishable key ya se exige por default en `/store/*`. El `customer_id` que
 * llega es sólo una pista de segmentación, nunca una credencial.
 *
 * `sales_channel_id` viene en el body porque en este repo no hay resolución
 * publishable-key → canal; el storefront lo manda desde `getActiveSalesChannelId()`.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = req.validatedBody as PostStoreRecommendationsInput;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  // Stock, precio y contenido del carrito se evalúan en cada request: cachear esta
  // respuesta mostraría productos sin stock o ya agregados al carrito.
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    const result = await resolveRecommendations(req.scope, {
      placement: body.placement,
      product_id: body.product_id ?? null,
      cart_id: body.cart_id ?? null,
      customer_id: body.customer_id ?? null,
      session_id: body.session_id ?? null,
      sales_channel_id: body.sales_channel_id ?? null,
      region_id: body.region_id ?? null,
      limit: body.limit ?? null,
      context: body.context ?? null,
    });

    // La fila `served` se escribe DESPUÉS de armar la respuesta y se espera antes de
    // contestar: es un solo INSERT (~1-2 ms sobre el mismo pool) y sin ella los
    // eventos que el storefront dispare a continuación caerían como
    // `unknown_request`, perdiendo el embudo entero de ese request.
    await recordServed(req.scope, result);

    const { served_context: _servedContext, debug, ...payload } = result;
    res.json(recommendationsDebugEnabled() ? { ...payload, debug } : payload);
  } catch (error) {
    // Una recomendación es decoración: si el motor falla, la ficha de producto o el
    // carrito tienen que seguir funcionando. Se loguea y se devuelve 200 vacío en
    // lugar de un 500 que el storefront convertiría en un error boundary.
    logger.error(
      `[recommendations] fallo al resolver el placement "${body.placement}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    res.json({
      request_id: null,
      placement: body.placement,
      strategy_key: null,
      resolved_strategy_key: null,
      fallback_used: false,
      fallback_chain: [],
      version_id: null,
      limit: 0,
      count: 0,
      products: [],
    });
  }
}
