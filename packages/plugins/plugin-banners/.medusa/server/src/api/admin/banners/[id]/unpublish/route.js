"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const unpublish_banner_1 = require("../../../../../workflows/unpublish-banner");
/**
 * POST /admin/banners/:id/unpublish — set status back to 'draft' (via workflow)
 */
async function POST(req, res) {
    try {
        const { result } = await (0, unpublish_banner_1.unpublishBannerWorkflow)(req.scope).run({
            input: {
                id: req.params.id,
                user_id: req.auth_context?.actor_id,
            },
        });
        return res.status(200).json({ banner: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error unpublishing banner';
        console.error('[Admin Banners] Error unpublishing banner:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jhbm5lcnMvW2lkXS91bnB1Ymxpc2gvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFNQSxvQkFjQztBQW5CRCxnRkFBb0Y7QUFFcEY7O0dBRUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSwwQ0FBdUIsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQzlELEtBQUssRUFBRTtnQkFDTCxFQUFFLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZO2dCQUMzQixPQUFPLEVBQUcsR0FBVyxDQUFDLFlBQVksRUFBRSxRQUFRO2FBQzdDO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsMkJBQTJCLENBQUM7UUFDckYsT0FBTyxDQUFDLEtBQUssQ0FBQyw0Q0FBNEMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNyRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9