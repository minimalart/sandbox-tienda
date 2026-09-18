import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { confirmBundleWorkflow } from '../../../../workflows/bundle/confirm-bundle';
import type { ConfirmBundleInput } from '../schemas';

/**
 * POST /store/bundles/confirm — validate the wizard selections server-side
 * and atomically add the resolved variants to the cart with bundle metadata.
 *
 * The line items are grouped by `bundle_instance_id` (generated inside the
 * workflow) so the cart can visually collapse them and `Editar` / `Eliminar`
 * can target the whole group.
 */
export async function POST(
  req: MedusaRequest<ConfirmBundleInput>,
  res: MedusaResponse,
): Promise<void> {
  const input = req.validatedBody as ConfirmBundleInput;

  const { result } = await confirmBundleWorkflow(req.scope).run({
    input: {
      bundle_id: input.bundle_id,
      cart_id: input.cart_id,
      selections: input.selections,
    },
  });

  res.status(200).json(result);
}
