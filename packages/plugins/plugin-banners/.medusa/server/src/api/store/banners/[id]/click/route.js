"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const banner_1 = require("../../../../../modules/banner");
/**
 * POST /store/banners/:id/click — track a banner click
 */
async function POST(req, res) {
    try {
        const bannerService = req.scope.resolve(banner_1.BANNER_MODULE);
        await bannerService.trackClick(req.params.id);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[Banners] Error tracking click:', error);
        return res.status(200).json({ success: false });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2Jhbm5lcnMvW2lkXS9jbGljay9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLG9CQVNDO0FBZkQsMERBQThEO0FBRzlEOztHQUVHO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sYUFBYSxHQUF3QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxzQkFBYSxDQUFDLENBQUM7UUFDNUUsTUFBTSxhQUFhLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7UUFDeEQsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4RCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDbEQsQ0FBQztBQUNILENBQUMifQ==