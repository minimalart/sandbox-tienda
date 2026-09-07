import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BANNER_MODULE } from '../../../modules/banner';
import type BannerModuleService from '../../../modules/banner/service';
import { createBannerWorkflow } from '../../../workflows/create-banner';
import { PostAdminCreateBanner } from './validators';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteFilter } from '../../../lib/multistore/scope';
import { BANNER_SITE_SCOPE } from '../../../modules/banner/site-scope';

/**
 * GET /admin/banners — list all banners (no filters, admin sees everything)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const bannerService: BannerModuleService = req.scope.resolve(BANNER_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const siteScope = await siteFilter(req.scope, await siteFromRequest(req), BANNER_SITE_SCOPE);

    const [banners, count] = await bannerService.listAndCountBanners(
      { deleted_at: null, ...siteScope },
      { skip: offset, take: limit, order: { priority: 'DESC' } }
    );
    return res.status(200).json({ banners, count, offset, limit });
  } catch (error) {
    console.error('[Admin Banners] Error listing banners:', error);
    return res.status(500).json({ message: 'Error fetching banners' });
  }
}

/**
 * POST /admin/banners — create a banner (validated, via workflow with audit trail)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminCreateBanner.parse(req.body);

    const { result } = await createBannerWorkflow(req.scope).run({
      input: {
        ...validated,
        user_id: (req as any).auth_context?.actor_id,
      },
    });

    return res.status(201).json({ banner: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creating banner';
    console.error('[Admin Banners] Error creating banner:', message);
    return res.status(400).json({ message });
  }
}
