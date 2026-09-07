import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BANNER_MODULE } from '../../../../modules/banner';
import type BannerModuleService from '../../../../modules/banner/service';
import { deleteBannerWorkflow } from '../../../../workflows/delete-banner';
import { updateBannerWorkflow } from '../../../../workflows/update-banner';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../lib/multistore/scope';
import { BANNER_SITE_SCOPE } from '../../../../modules/banner/site-scope';
import { PostAdminUpdateBanner } from '../validators';

/**
 * GET /admin/banners/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const bannerService: BannerModuleService = req.scope.resolve(BANNER_MODULE);
    const banner = await bannerService.retrieveBanner(req.params.id as string);
    assertRowInSite(banner as Record<string, unknown>, await siteFromRequest(req), BANNER_SITE_SCOPE);
    return res.status(200).json({ banner });
  } catch (error) {
    console.error('[Admin Banners] Error retrieving banner:', error);
    return res.status(404).json({ message: 'Banner not found' });
  }
}

/**
 * POST /admin/banners/:id — update a banner (validated, via workflow with audit trail)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminUpdateBanner.parse(req.body);

    const bannerService: BannerModuleService = req.scope.resolve(BANNER_MODULE);
    assertRowInSite(
      (await bannerService.retrieveBanner(req.params.id as string)) as Record<string, unknown>,
      await siteFromRequest(req),
      BANNER_SITE_SCOPE,
    );

    const { result } = await updateBannerWorkflow(req.scope).run({
      input: {
        id: req.params.id as string,
        data: validated,
        user_id: (req as any).auth_context?.actor_id,
      },
    });

    return res.status(200).json({ banner: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error updating banner';
    console.error('[Admin Banners] Error updating banner:', message);
    return res.status(400).json({ message });
  }
}

/**
 * DELETE /admin/banners/:id — delete via workflow (with audit trail)
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const bannerService: BannerModuleService = req.scope.resolve(BANNER_MODULE);
    assertRowInSite(
      (await bannerService.retrieveBanner(req.params.id as string)) as Record<string, unknown>,
      await siteFromRequest(req),
      BANNER_SITE_SCOPE,
    );

    const { result } = await deleteBannerWorkflow(req.scope).run({
      input: {
        id: req.params.id as string,
        user_id: (req as any).auth_context?.actor_id,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error deleting banner';
    console.error('[Admin Banners] Error deleting banner:', message);
    return res.status(400).json({ message });
  }
}
