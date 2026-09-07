import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_EXECUTION_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

// GET /admin/delivery/executions/:id/proofs — lista los ProofOfDelivery (M5) de
// una ejecución, para que el ops board muestre la evidencia de entrega
// (fotos, firma, geo, PIN). Read-only.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es la ejecución, o sea el PADRE. Guardarlo a él alcanza: sus
  // hijas no son alcanzables por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_EXECUTION_SITE_SCOPE, req.params.id as string);

  const executionId = req.params.id as string;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: proofs } = await query.graph({
    entity: 'proof_of_delivery',
    fields: [
      'id',
      'delivery_execution_id',
      'type',
      'file_url',
      'signature_url',
      'captured_lat',
      'captured_lng',
      'captured_by',
      'pin_validated',
      'note',
      'captured_at',
      'metadata',
      'created_at',
    ],
    filters: { delivery_execution_id: executionId },
    pagination: { order: { captured_at: 'DESC' } },
  });

  res.status(200).json({
    proofs_of_delivery: proofs,
    count: proofs.length,
  });
}
