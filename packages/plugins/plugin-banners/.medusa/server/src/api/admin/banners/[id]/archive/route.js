"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const archive_banner_1 = require("../../../../../workflows/archive-banner");
/**
 * POST /admin/banners/:id/archive — set status to 'archived' (via workflow)
 */
async function POST(req, res) {
    try {
        const { result } = await (0, archive_banner_1.archiveBannerWorkflow)(req.scope).run({
            input: {
                id: req.params.id,
                user_id: req.auth_context?.actor_id,
            },
        });
        return res.status(200).json({ banner: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error archiving banner';
        console.error('[Admin Banners] Error archiving banner:', message);
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jhbm5lcnMvW2lkXS9hcmNoaXZlL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBTUEsb0JBY0M7QUFuQkQsNEVBQWdGO0FBRWhGOztHQUVHO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUEsc0NBQXFCLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUM1RCxLQUFLLEVBQUU7Z0JBQ0wsRUFBRSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWTtnQkFDM0IsT0FBTyxFQUFHLEdBQVcsQ0FBQyxZQUFZLEVBQUUsUUFBUTthQUM3QztTQUNGLENBQUMsQ0FBQztRQUNILE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLHdCQUF3QixDQUFDO1FBQ2xGLE9BQU8sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbEUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDM0MsQ0FBQztBQUNILENBQUMifQ==