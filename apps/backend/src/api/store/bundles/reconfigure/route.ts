import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { reconfigureBundleWorkflow } from '../../../../workflows/bundle/reconfigure-bundle';

const ReconfigureSchema = z.object({
  bundle_id: z.string().min(1),
  cart_id: z.string().min(1),
  bundle_instance_id: z.string().min(1),
  selections: z
    .array(
      z.object({
        bundle_item_id: z.string().min(1),
        variant_id: z.string().min(1),
      }),
    )
    .min(1),
});

/**
 * POST /store/bundles/reconfigure — replace an existing bundle instance in
 * the cart with a new set of selections. Server-authoritative validation,
 * atomic in the happy path (new items added before old are deleted).
 *
 * Validation is inline here — the endpoint isn't in the shared
 * `middlewares.ts` list because reconfigure is F3 and the extension
 * middlewares are generated from the composer.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = ReconfigureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'BUNDLE_RECONFIGURE_INVALID', issues: parsed.error.issues });
    return;
  }
  const { result } = await reconfigureBundleWorkflow(req.scope).run({ input: parsed.data });
  res.status(200).json(result);
}
