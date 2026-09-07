import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_ROUTE_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import updateRouteStopsWorkflow from '../../../../../../workflows/update-route-stops';
import type { AdminUpdateRouteStopsType } from '../../../validators';

// POST|PUT /admin/delivery/routes/:id/stops — reemplaza el set de paradas.
//
// El body trae el estado FINAL deseado de las paradas (orden = sequence). El
// workflow update-route-stops hace el diff: actualiza sequences, crea nuevas
// (validando flota propia / no terminal / sin otra ruta), borra las que salieron
// y mantiene la consistencia de execution.route_id. El planner del admin usa
// esto en cada reordenamiento (botones up/down recalculan sequence 1..n).
async function handle(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // Mismo guard que el detalle de la ruta, y en el `handle` compartido para que
  // valga por POST y por PUT: esto reemplaza el set entero de paradas, o sea que
  // sin guard el id de una ruta ajena deja vaciarle el reparto a otra tienda.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ROUTE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const body = req.validatedBody as AdminUpdateRouteStopsType;

  const { result } = await updateRouteStopsWorkflow(req.scope).run({
    input: {
      route_id: id,
      stops: body.stops,
    },
  });

  res.status(200).json({ route: result });
}

export const POST = handle;
export const PUT = handle;
