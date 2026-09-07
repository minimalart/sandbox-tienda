import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { STORE_LOCATION_SITE_SCOPE } from '../../../../../modules/store-location/site-scope';
import { DELIVERY_ZONE_SITE_SCOPE } from '../../../../../modules/delivery/site-scope';
import autoBuildRoutesWorkflow from '../../../../../workflows/auto-build-routes';
import type { AdminAutoBuildRoutesType } from '../../validators';

// POST /admin/delivery/routes/auto-build — auto-armado de rutas de flota propia.
//
// Toma las ejecuciones own_fleet sin rutear de la sucursal (y zona si viene), las
// reparte entre los vehículos disponibles por bin-packing (First-Fit-Decreasing,
// respetando capacidad de peso/volumen, tope de órdenes y compatibilidad de
// temperatura) y crea una Route por bin reusando el workflow create-route. Si
// `optimize` es true, además optimiza el orden de cada ruta (optimize-route).
//
// SOLO flota propia. Devuelve las rutas creadas y las ejecuciones que no pudieron
// asignarse (sin vehículo compatible / sin cupo) para mostrarlas en la UI.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = req.validatedBody as AdminAutoBuildRoutesType;

  /**
   * Es la gemela de `delivery/executions/[id]/auto-assign` —la que se escapó del
   * primer ratchet— con el id en el BODY en vez del path. Escribe igual: crea
   * Routes, les cuelga paradas y le setea `route_id` a cada ejecución de la
   * sucursal. Y por venir en el body no la miraba NINGUNO de los tres ratchets:
   * verbo de mutación, sin GET, sin `[param]`.
   *
   * `assertIdInSite` y no `assertRowInSite`: `delivery_zone` es `via_parent`, y
   * para esa forma `assertRowInSite` hace `return` sin chequear nada — sería el
   * guard decorativo que documenta el propio `MAX_SIN_GUARD`.
   *
   * La zona se valida ADEMÁS de la sucursal, no en su lugar: son dos ids
   * independientes del body, y validar sólo uno deja la otra puerta abierta.
   */
  const resolution = await siteFromRequest(req);
  await assertIdInSite(req.scope, resolution, STORE_LOCATION_SITE_SCOPE, body.store_location_id);
  if (body.delivery_zone_id) {
    await assertIdInSite(req.scope, resolution, DELIVERY_ZONE_SITE_SCOPE, body.delivery_zone_id);
  }

  const { result } = await autoBuildRoutesWorkflow(req.scope).run({
    input: {
      store_location_id: body.store_location_id,
      delivery_zone_id: body.delivery_zone_id ?? null,
      planned_date: body.planned_date ?? null,
      max_orders_per_vehicle: body.max_orders_per_vehicle ?? null,
      fill_priority: body.fill_priority,
      optimize: body.optimize ?? false,
    },
  });

  res.status(201).json(result);
}
