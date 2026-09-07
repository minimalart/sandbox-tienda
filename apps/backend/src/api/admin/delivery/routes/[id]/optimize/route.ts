import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_ROUTE_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import optimizeRouteWorkflow from '../../../../../../workflows/optimize-route';

// POST /admin/delivery/routes/:id/optimize — optimiza el ORDEN de las paradas.
//
// Corre el workflow optimize-route (nearest-neighbor + 2-opt sobre haversine),
// reescribe los sequence de los RouteStops minimizando la distancia total desde
// la sucursal de origen (o el primer stop con coords como fallback) y persiste
// las métricas en route.optimization_meta. SOLO reordena: no cambia qué stops
// tiene la ruta. Idempotente (reoptimizar una ruta óptima reporta 0% de mejora).
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // Mismo guard que el detalle de la ruta: reordenar sólo cambia `sequence`,
  // pero reescribe filas de otra tienda —y le cambia el recorrido del día a un
  // repartidor ajeno— con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ROUTE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;

  const { result } = await optimizeRouteWorkflow(req.scope).run({
    input: { route_id: id },
  });

  res.status(200).json({ optimization: result });
}
