import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_EXECUTION_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import assignDeliveryWorkflow from '../../../../../../workflows/assign-delivery';
import type { AdminAssignDeliveryType } from '../../../validators';

// POST /admin/delivery/executions/:id/assign — asigna driver (+ vehicle) a la
// ejecución y la transiciona a 'assigned' (flota propia). Corre el workflow
// assign-delivery, que valida, persiste la asignación y NO proyecta a Medusa.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  /**
   * Mismo guard, mismo descriptor y misma razón que su vecina `auto-assign`: el id de la
   * ruta es la EJECUCIÓN, o sea el padre, y guardarlo a él alcanza porque sus hijas no
   * son alcanzables por otra vía. Es el patrón que ya usaba `eligible-resources`.
   *
   * Esta versión es la MANUAL y por eso es la más directa de explotar de las tres: el
   * `driver_id` llega en el body, así que sin el guard cualquier operador podía tomar una
   * ejecución ajena por su id y encajarle un repartidor de su propia flota.
   *
   * `assertIdInSite` y no `assertRowInSite`: el descriptor es `via_parent` (ejecución →
   * sucursal → tienda) y `assertRowInSite` hace `return` sin chequear para esa forma.
   */
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_EXECUTION_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const body = req.validatedBody as AdminAssignDeliveryType;

  const { result } = await assignDeliveryWorkflow(req.scope).run({
    input: {
      execution_id: id,
      driver_id: body.driver_id,
      vehicle_id: body.vehicle_id ?? undefined,
      set_driver_on_route: body.set_driver_on_route,
      attach_to_route: body.attach_to_route,
    },
  });

  res.status(200).json({ assignment: result });
}
