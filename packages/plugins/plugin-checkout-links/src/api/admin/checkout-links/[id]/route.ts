import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { CHECKOUT_LINK_SITE_SCOPE } from '../../../../modules/checkout-link/site-scope';
import { CHECKOUT_LINK_MODULE } from '../../../../modules/checkout-link';
import type CheckoutLinkModuleService from '../../../../modules/checkout-link/service';
import { PostAdminUpdateCheckoutLink } from '../validators';
import { withPublicUrl } from '../helpers';

/**
 * GET /admin/checkout-links/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), CHECKOUT_LINK_SITE_SCOPE, req.params.id as string);

  try {
    const service: CheckoutLinkModuleService =
      req.scope.resolve(CHECKOUT_LINK_MODULE);
    const checkout_link = await service.retrieveCheckoutLink(
      req.params.id as string,
    );
    return res.status(200).json({ checkout_link: withPublicUrl(checkout_link as any) });
  } catch (error) {
    console.error('[Admin CheckoutLinks] Error retrieving link:', error);
    return res.status(404).json({ message: 'Checkout link not found' });
  }
}

/**
 * POST /admin/checkout-links/:id — update (status, expiry, items, etc.)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), CHECKOUT_LINK_SITE_SCOPE, req.params.id as string);

  try {
    const service: CheckoutLinkModuleService =
      req.scope.resolve(CHECKOUT_LINK_MODULE);
    const validated = PostAdminUpdateCheckoutLink.parse(req.body);

    const checkout_link = await (service as any).updateCheckoutLinks({
      id: req.params.id as string,
      ...validated,
      ...(validated.expires_at !== undefined
        ? {
            expires_at: validated.expires_at
              ? new Date(validated.expires_at)
              : null,
          }
        : {}),
    });

    return res.status(200).json({ checkout_link: withPublicUrl(checkout_link as any) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating checkout link';
    console.error('[Admin CheckoutLinks] Error updating link:', message);
    return res.status(400).json({ message });
  }
}

/**
 * DELETE /admin/checkout-links/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), CHECKOUT_LINK_SITE_SCOPE, req.params.id as string);

  try {
    const service: CheckoutLinkModuleService =
      req.scope.resolve(CHECKOUT_LINK_MODULE);
    await (service as any).deleteCheckoutLinks(req.params.id as string);
    return res
      .status(200)
      .json({ id: req.params.id, object: 'checkout_link', deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error deleting checkout link';
    console.error('[Admin CheckoutLinks] Error deleting link:', message);
    return res.status(400).json({ message });
  }
}
