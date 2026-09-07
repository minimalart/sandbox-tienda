import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { CHECKOUT_LINK_SITE_SCOPE } from '../../../modules/checkout-link/site-scope';
import { CHECKOUT_LINK_MODULE } from '../../../modules/checkout-link';
import type CheckoutLinkModuleService from '../../../modules/checkout-link/service';
import { createCheckoutLinkWorkflow } from '../../../workflows/create-checkout-link';
import { PostAdminCreateCheckoutLink } from './validators';
import { withPublicUrl } from './helpers';

/**
 * GET /admin/checkout-links — list all checkout links (newest first)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: CheckoutLinkModuleService =
      req.scope.resolve(CHECKOUT_LINK_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const resolution = await siteFromRequest(req);
    const [checkout_links, count] = await service.listAndCountCheckoutLinks(
      {
        deleted_at: null,
        ...(await siteFilter(req.scope, resolution, CHECKOUT_LINK_SITE_SCOPE)),
      },
      { skip: offset, take: limit, order: { created_at: 'DESC' } },
    );
    return res.status(200).json({
      checkout_links: checkout_links.map((l: any) => withPublicUrl(l)),
      count,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[Admin CheckoutLinks] Error listing links:', error);
    return res.status(500).json({ message: 'Error fetching checkout links' });
  }
}

/**
 * POST /admin/checkout-links — create a checkout link (validated, via workflow)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminCreateCheckoutLink.parse(req.body);

    /**
     * Los defaults van PRIMERO: un `sales_channel_id` explícito en el body gana.
     * Al revés, el default pisaría siempre y el campo del formulario sería
     * decorativo.
     */
    const { result } = await createCheckoutLinkWorkflow(req.scope).run({
      input: {
        ...siteDefaults(await siteFromRequest(req), CHECKOUT_LINK_SITE_SCOPE),
        ...validated,
        created_by: (req as any).auth_context?.actor_id,
      },
    });

    return res.status(201).json({ checkout_link: withPublicUrl(result as any) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error creating checkout link';
    console.error('[Admin CheckoutLinks] Error creating link:', message);
    return res.status(400).json({ message });
  }
}
