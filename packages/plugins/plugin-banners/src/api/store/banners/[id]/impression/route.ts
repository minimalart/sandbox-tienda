import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BANNER_MODULE } from '../../../../../modules/banner';
import type BannerModuleService from '../../../../../modules/banner/service';

/**
 * POST /store/banners/:id/impression — track a banner impression
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const bannerService: BannerModuleService = req.scope.resolve(BANNER_MODULE);
    await bannerService.trackImpression(req.params.id as string);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Banners] Error tracking impression:', error);
    return res.status(200).json({ success: false });
  }
}
