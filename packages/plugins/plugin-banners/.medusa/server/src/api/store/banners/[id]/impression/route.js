"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const banner_1 = require("../../../../../modules/banner");
/**
 * POST /store/banners/:id/impression — track a banner impression
 */
async function POST(req, res) {
    try {
        const bannerService = req.scope.resolve(banner_1.BANNER_MODULE);
        await bannerService.trackImpression(req.params.id);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[Banners] Error tracking impression:', error);
        return res.status(200).json({ success: false });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2Jhbm5lcnMvW2lkXS9pbXByZXNzaW9uL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBT0Esb0JBU0M7QUFmRCwwREFBOEQ7QUFHOUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxhQUFhLEdBQXdCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLHNCQUFhLENBQUMsQ0FBQztRQUM1RSxNQUFNLGFBQWEsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztRQUM3RCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzdELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNsRCxDQUFDO0FBQ0gsQ0FBQyJ9