import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BANNER_MODULE } from '../../../modules/banner';
import type BannerModuleService from '../../../modules/banner/service';

/**
 * GET /store/banners
 *
 * Query params:
 *   placement  (repeatable) — filter by placement(s), required
 *   sales_channel_id, customer_group_id, locale, country, device, path
 *     — optional targeting inputs matched against each banner's `rules`
 *
 * Returns: { banners: RawApiBanner[] } published, active (date window) and
 * rule-matched, ordered by priority DESC.
 * Always returns 200 — empty array when nothing matches or on error.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const bannerService: BannerModuleService = req.scope.resolve(BANNER_MODULE);

    const rawPlacements = req.query['placement'];
    const placements: string[] =
      rawPlacements == null
        ? []
        : Array.isArray(rawPlacements)
          ? (rawPlacements as string[])
          : [rawPlacements as string];

    if (placements.length === 0) {
      return res.status(200).json({ banners: [] });
    }

    const rawGroups = req.query['customer_group_id'];
    const customerGroupIds: string[] =
      rawGroups == null
        ? []
        : Array.isArray(rawGroups)
          ? (rawGroups as string[])
          : [rawGroups as string];

    const requireSalesChannel =
      req.query['require_sales_channel'] === '1' ||
      req.query['require_sales_channel'] === 'true';

    const banners = await bannerService.resolveBanners({
      placement: placements,
      sales_channel_id: req.query['sales_channel_id'] as string,
      customer_group_ids: customerGroupIds,
      locale: req.query['locale'] as string,
      country: req.query['country'] as string,
      device: req.query['device'] as 'mobile' | 'desktop',
      path: req.query['path'] as string,
      require_sales_channel: requireSalesChannel,
    });

    return res.status(200).json({ banners });
  } catch (error) {
    console.error('[Banners] Error fetching banners:', error);
    return res.status(200).json({ banners: [] });
  }
}
