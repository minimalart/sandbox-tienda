"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const loyalty_1 = require("../../../../modules/loyalty");
const rewards_1 = require("../../../../modules/loyalty/lib/rewards");
// Redeemable rewards for the active program, cheapest first.
async function GET(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const program = await service.getActiveProgram();
    if (!program) {
        res.json({ rewards: [], points_name: 'puntos' });
        return;
    }
    const rewards = (await service.listRewards({ program_id: program.id, status: 'active' }, { order: { cost_points: 'ASC' } }));
    const now = Date.now();
    const redeemable = rewards.filter((r) => (0, rewards_1.rewardRedeemability)(r, now).ok);
    res.json({ rewards: redeemable, points_name: program.points_name ?? 'puntos' });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2xveWFsdHkvcmV3YXJkcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU1BLGtCQWlCQztBQXRCRCx5REFBNkQ7QUFFN0QscUVBQThFO0FBRTlFLDZEQUE2RDtBQUN0RCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ2pELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNiLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxXQUFXLENBQ3hDLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxFQUM1QyxFQUFFLEtBQUssRUFBRSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUNsQyxDQUErQixDQUFDO0lBRWpDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUN2QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLDZCQUFtQixFQUFDLENBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVoRixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVcsSUFBSSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBQ2xGLENBQUMifQ==