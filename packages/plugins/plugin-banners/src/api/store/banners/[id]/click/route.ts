import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BANNER_MODULE } from '../../../../../modules/banner';
import type BannerModuleService from '../../../../../modules/banner/service';

/**
 * POST /store/banners/:id/click — track a banner click
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const bannerService: BannerModuleService = req.scope.resolve(BANNER_MODULE);
    await bannerService.trackClick(req.params.id as string);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Banners] Error tracking click:', error);
    return res.status(200).json({ success: false });
  }
}
