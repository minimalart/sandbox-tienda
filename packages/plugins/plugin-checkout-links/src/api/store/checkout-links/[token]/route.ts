import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { CHECKOUT_LINK_MODULE } from '../../../../modules/checkout-link';
import type CheckoutLinkModuleService from '../../../../modules/checkout-link/service';

/**
 * GET /store/checkout-links/:token
 *
 * Public resolver for a preloaded checkout link. Returns only the data needed
 * to build the cart (never `created_by`/internal metadata). Responds 404 when
 * the link is missing, disabled, expired, or a consumed single-use link.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: CheckoutLinkModuleService =
      req.scope.resolve(CHECKOUT_LINK_MODULE);

    const resolved = await service.resolveByToken(req.params.token as string);

    if (!resolved) {
      return res
        .status(404)
        .json({ message: 'Checkout link not found or no longer available' });
    }

    return res.status(200).json({ checkout_link: resolved });
  } catch (error) {
    console.error('[Store CheckoutLinks] Error resolving token:', error);
    return res
      .status(404)
      .json({ message: 'Checkout link not found or no longer available' });
  }
}
