import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_ROUTE_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import dispatchRouteWorkflow from '../../../../../../workflows/dispatch-route';

// POST /admin/delivery/routes/:id/dispatch — despacha la ruta.
//
// Marca la ruta 'dispatched' + started_at y propaga la asignación del
// driver/vehicle de la ruta a cada ejecución no asignada, reusando el workflow
// assign-delivery. Requiere que la ruta tenga driver asignado.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // Mismo guard que el detalle de la ruta: acá no se lee, se despacha y se
  // propaga driver/vehicle a cada ejecución, así que sin esto el id de una ruta
  // ajena alcanza para meter flota propia en las entregas de otra tienda.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ROUTE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;

  const { result } = await dispatchRouteWorkflow(req.scope).run({
    input: { route_id: id },
  });

  res.status(200).json({ dispatch: result });
}
