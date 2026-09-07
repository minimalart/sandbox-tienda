import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_EXECUTION_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../../modules/delivery/service';
import { fetchExecutionOrderAggregate } from '../../../../../../modules/delivery/order-query';

// GET /admin/delivery/executions/:id/eligible-resources — previsualiza los
// recursos de flota propia ELEGIBLES (drivers/vehicles) y los rechazados con su
// motivo, para que la UI muestre candidatos antes de auto-asignar. Solo lectura.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es la ejecución, o sea el PADRE. Guardarlo a él alcanza: sus
  // hijas no son alcanzables por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_EXECUTION_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const orderAggregate = await fetchExecutionOrderAggregate(query, id);
  const eligibility = await service.getEligibleResources(id, orderAggregate);

  res.status(200).json({ eligible_resources: eligibility });
}
