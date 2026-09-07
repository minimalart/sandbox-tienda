import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ingestEvents } from '../../../../modules/recommendations/events/record';
import type { PostStoreRecommendationEventsInput } from '../validators';

/**
 * POST /store/recommendations/events — ingesta de eventos del storefront (PRD §15.2).
 *
 * Responde SIEMPRE 202, incluso cuando rechaza todo. Los eventos llegan por
 * `navigator.sendBeacon` y por `fetch(keepalive)`, que reintentan ante error: un 4xx
 * produciría un loop de reintentos por cada evento inválido. El detalle de lo
 * rechazado va en el body, para poder diagnosticar sin castigar al cliente.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = req.validatedBody as PostStoreRecommendationEventsInput;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  res.setHeader('Cache-Control', 'private, no-store');

  try {
    const result = await ingestEvents(req.scope, {
      request_id: body.request_id,
      events: body.events,
    });
    res.status(202).json(result);
  } catch (error) {
    logger.error(
      `[recommendations] fallo la ingesta de eventos: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    // Tampoco un 500: perder telemetría es preferible a un reintento en loop.
    res.status(202).json({ accepted: 0, duplicates: 0, rejected: [] });
  }
}
