import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_EXECUTION_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../../modules/delivery/service';

type UnknownRecord = Record<string, unknown>;

// GET /admin/delivery/executions/:id/events — timeline de TrackingEvents de una
// ejecución, ordenado por occurred_at ASC (cronológico, el más viejo primero).
//
// TrackingEvent es APPEND-ONLY y vive dentro del módulo delivery (FK lógica
// delivery_execution_id, no link), así que se lee con el service del módulo.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es la ejecución, o sea el PADRE. Guardarlo a él alcanza: sus
  // hijas no son alcanzables por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_EXECUTION_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const events = (await service.listTrackingEvents(
    { delivery_execution_id: id },
    { order: { occurred_at: 'ASC' } },
  )) as UnknownRecord[];

  res.status(200).json({
    events: events.map((e) => ({
      id: e.id,
      source: e.source,
      code: e.code,
      description: e.description ?? null,
      occurred_at: e.occurred_at,
      location: e.location ?? null,
    })),
    count: events.length,
  });
}
