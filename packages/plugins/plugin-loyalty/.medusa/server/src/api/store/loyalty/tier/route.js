"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const loyalty_1 = require("../../../../modules/loyalty");
const metrics_1 = require("../../../../modules/loyalty/lib/metrics");
const tiers_1 = require("../../../../modules/loyalty/lib/tiers");
// The authenticated customer's current tier + progress to the next one.
async function GET(req, res) {
    const customerId = req.auth_context?.actor_id;
    if (!customerId) {
        res.status(401).json({ message: 'No autenticado' });
        return;
    }
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const program = await service.getActiveProgram();
    if (!program) {
        res.json({ tier: null, next: null, toNext: 0, metrics: null });
        return;
    }
    const tiers = (await service.listTiers({ program_id: program.id }, { order: { threshold: 'ASC' } }));
    const metrics = await (0, metrics_1.gatherCustomerMetrics)(req.scope, customerId);
    const { current, next, toNext } = (0, tiers_1.tierProgress)(tiers, metrics);
    res.json({ tier: current, next, toNext, metrics });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2xveWFsdHkvdGllci9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLGtCQXNCQztBQTVCRCx5REFBNkQ7QUFFN0QscUVBQWdGO0FBQ2hGLGlFQUFxRTtBQUVyRSx3RUFBd0U7QUFDakUsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUErQixFQUFFLEdBQW1CO0lBQzVFLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDO0lBQzlDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNoQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7UUFDcEQsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDakQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2IsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQ3BDLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFDMUIsRUFBRSxLQUFLLEVBQUUsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FDaEMsQ0FBK0IsQ0FBQztJQUNqQyxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUEsK0JBQXFCLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNuRSxNQUFNLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFBLG9CQUFZLEVBQUMsS0FBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRXRFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUNyRCxDQUFDIn0=