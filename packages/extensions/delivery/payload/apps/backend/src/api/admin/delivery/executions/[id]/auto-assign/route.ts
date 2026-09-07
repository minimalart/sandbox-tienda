import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_EXECUTION_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import autoAssignDeliveryWorkflow from '../../../../../../workflows/auto-assign-delivery';
import type { AdminAutoAssignType } from '../../../validators';

// POST /admin/delivery/executions/:id/auto-assign — asignación AUTOMÁTICA de
// flota propia. Corre auto-assign-delivery: resuelve elegibles, elige
// driver(+vehicle) por estrategia y delega en assign-delivery. NO lanza error si
// no hay elegibles: devuelve { assigned: false, reason, rejected } para la UI.
//
// Body opcional: { strategy?, vehicle_id? }. `strategy` override manual (máxima
// precedencia); `vehicle_id` fuerza un vehículo concreto.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  /**
   * Mismo guard que su hermana `eligible-resources`, y por la misma razón: `req.params.id`
   * es la EJECUCIÓN, o sea el padre, y guardarlo a él alcanza porque sus hijas no son
   * alcanzables por otra vía.
   *
   * Que faltara acá y no allá es el agujero más caro de los dos: `eligible-resources`
   * sólo PREVISUALIZA candidatos, mientras que esta ruta ESCRIBE la asignación. Sin el
   * guard, saber el id de una ejecución ajena alcanzaba para mandarle un repartidor de
   * la propia flota a una entrega de otra tienda — con el vehículo ocupado, el turno
   * consumido y el cliente equivocado esperando.
   *
   * `assertIdInSite` y no `assertRowInSite`: `DELIVERY_EXECUTION_SITE_SCOPE` no se puede
   * validar leyendo la fila, y además el handler no la lee — delega todo en el workflow.
   */
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_EXECUTION_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const body = (req.validatedBody ?? {}) as AdminAutoAssignType;

  const { result } = await autoAssignDeliveryWorkflow(req.scope).run({
    input: {
      execution_id: id,
      strategy: body.strategy,
      vehicle_id: body.vehicle_id,
    },
  });

  res.status(200).json({ assignment: result });
}
