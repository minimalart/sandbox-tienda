"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const banner_1 = require("../../../modules/banner");
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
async function GET(req, res) {
    try {
        const bannerService = req.scope.resolve(banner_1.BANNER_MODULE);
        const rawPlacements = req.query['placement'];
        const placements = rawPlacements == null
            ? []
            : Array.isArray(rawPlacements)
                ? rawPlacements
                : [rawPlacements];
        if (placements.length === 0) {
            return res.status(200).json({ banners: [] });
        }
        const rawGroups = req.query['customer_group_id'];
        const customerGroupIds = rawGroups == null
            ? []
            : Array.isArray(rawGroups)
                ? rawGroups
                : [rawGroups];
        const requireSalesChannel = req.query['require_sales_channel'] === '1' ||
            req.query['require_sales_channel'] === 'true';
        const banners = await bannerService.resolveBanners({
            placement: placements,
            sales_channel_id: req.query['sales_channel_id'],
            customer_group_ids: customerGroupIds,
            locale: req.query['locale'],
            country: req.query['country'],
            device: req.query['device'],
            path: req.query['path'],
            require_sales_channel: requireSalesChannel,
        });
        return res.status(200).json({ banners });
    }
    catch (error) {
        console.error('[Banners] Error fetching banners:', error);
        return res.status(200).json({ banners: [] });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2Jhbm5lcnMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFnQkEsa0JBNENDO0FBM0RELG9EQUF3RDtBQUd4RDs7Ozs7Ozs7Ozs7R0FXRztBQUNJLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLGFBQWEsR0FBd0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsc0JBQWEsQ0FBQyxDQUFDO1FBRTVFLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDN0MsTUFBTSxVQUFVLEdBQ2QsYUFBYSxJQUFJLElBQUk7WUFDbkIsQ0FBQyxDQUFDLEVBQUU7WUFDSixDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUM7Z0JBQzVCLENBQUMsQ0FBRSxhQUEwQjtnQkFDN0IsQ0FBQyxDQUFDLENBQUMsYUFBdUIsQ0FBQyxDQUFDO1FBRWxDLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM1QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUNqRCxNQUFNLGdCQUFnQixHQUNwQixTQUFTLElBQUksSUFBSTtZQUNmLENBQUMsQ0FBQyxFQUFFO1lBQ0osQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO2dCQUN4QixDQUFDLENBQUUsU0FBc0I7Z0JBQ3pCLENBQUMsQ0FBQyxDQUFDLFNBQW1CLENBQUMsQ0FBQztRQUU5QixNQUFNLG1CQUFtQixHQUN2QixHQUFHLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLEtBQUssR0FBRztZQUMxQyxHQUFHLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLEtBQUssTUFBTSxDQUFDO1FBRWhELE1BQU0sT0FBTyxHQUFHLE1BQU0sYUFBYSxDQUFDLGNBQWMsQ0FBQztZQUNqRCxTQUFTLEVBQUUsVUFBVTtZQUNyQixnQkFBZ0IsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFXO1lBQ3pELGtCQUFrQixFQUFFLGdCQUFnQjtZQUNwQyxNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQVc7WUFDckMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFXO1lBQ3ZDLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBeUI7WUFDbkQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFXO1lBQ2pDLHFCQUFxQixFQUFFLG1CQUFtQjtTQUMzQyxDQUFDLENBQUM7UUFFSCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUNBQW1DLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUQsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQy9DLENBQUM7QUFDSCxDQUFDIn0=