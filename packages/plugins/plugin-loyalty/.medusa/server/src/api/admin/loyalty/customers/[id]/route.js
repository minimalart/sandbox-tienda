"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const loyalty_1 = require("../../../../../modules/loyalty");
const points_1 = require("../../../../../modules/points");
const metrics_1 = require("../../../../../modules/loyalty/lib/metrics");
const tiers_1 = require("../../../../../modules/loyalty/lib/tiers");
// A customer's loyalty summary for the customer-detail admin widget: balance,
// tier + progress, recent ledger movements and reward grants.
async function GET(req, res) {
    const customerId = req.params.id;
    const points = req.scope.resolve(points_1.POINTS_MODULE);
    const loyalty = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const balance = await points.getAvailableBalance(customerId);
    const accounts = (await points.listPointsAccounts({ customer_id: customerId }));
    const account = accounts[0];
    const transactions = account
        ? await points.listPointsTransactions({ account_id: account.id }, { order: { created_at: 'DESC' }, take: 20 })
        : [];
    const grants = await loyalty.listRewardGrants({ customer_id: customerId }, { relations: ['reward'], order: { created_at: 'DESC' }, take: 20 });
    let tier = null;
    let progress = null;
    const program = await loyalty.getActiveProgram();
    if (program) {
        const tiers = (await loyalty.listTiers({ program_id: program.id }, { order: { threshold: 'ASC' } }));
        const metrics = await (0, metrics_1.gatherCustomerMetrics)(req.scope, customerId);
        const p = (0, tiers_1.tierProgress)(tiers, metrics);
        tier = p.current;
        progress = { next: p.next, toNext: p.toNext, metrics };
    }
    res.json({ balance, tier, progress, transactions, grants });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvY3VzdG9tZXJzL1tpZF0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFVQSxrQkFrQ0M7QUEzQ0QsNERBQWdFO0FBRWhFLDBEQUE4RDtBQUU5RCx3RUFBbUY7QUFDbkYsb0VBQXdFO0FBRXhFLDhFQUE4RTtBQUM5RSw4REFBOEQ7QUFDdkQsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQzNDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFzQixzQkFBYSxDQUFDLENBQUM7SUFDckUsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztJQUV4RSxNQUFNLE9BQU8sR0FBRyxNQUFNLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM3RCxNQUFNLFFBQVEsR0FBRyxDQUFDLE1BQU0sTUFBTSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQTBCLENBQUM7SUFDekcsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVCLE1BQU0sWUFBWSxHQUFHLE9BQU87UUFDMUIsQ0FBQyxDQUFDLE1BQU0sTUFBTSxDQUFDLHNCQUFzQixDQUNqQyxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQzFCLEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FDNUM7UUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ1AsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQzNDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxFQUMzQixFQUFFLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQ25FLENBQUM7SUFFRixJQUFJLElBQUksR0FBWSxJQUFJLENBQUM7SUFDekIsSUFBSSxRQUFRLEdBQStELElBQUksQ0FBQztJQUNoRixNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ2pELElBQUksT0FBTyxFQUFFLENBQUM7UUFDWixNQUFNLEtBQUssR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLFNBQVMsQ0FDcEMsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUMxQixFQUFFLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUNoQyxDQUErQixDQUFDO1FBQ2pDLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSwrQkFBcUIsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ25FLE1BQU0sQ0FBQyxHQUFHLElBQUEsb0JBQVksRUFBQyxLQUFZLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDOUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUM7UUFDakIsUUFBUSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUM7SUFDekQsQ0FBQztJQUVELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUM5RCxDQUFDIn0=