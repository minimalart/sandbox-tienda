import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { CHECKOUT_LINK_MODULE } from '../../../../../modules/checkout-link';
import type CheckoutLinkModuleService from '../../../../../modules/checkout-link/service';

/**
 * POST /store/checkout-links/:token/consume
 *
 * Marks a link as consumed once its order has been placed. Increments the usage
 * counter and, for single-use links, flips the status to `used` so the link can
 * no longer be resolved. Always returns 200 (best-effort, non-blocking for the
 * storefront's order-completion flow).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: CheckoutLinkModuleService =
      req.scope.resolve(CHECKOUT_LINK_MODULE);
    await service.markUsed(req.params.token as string);
  } catch (error) {
    console.error('[Store CheckoutLinks] Error consuming token:', error);
  }
  return res.status(200).json({ success: true });
}
