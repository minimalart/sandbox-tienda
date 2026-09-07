"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatherCustomerMetrics = gatherCustomerMetrics;
const utils_1 = require("@medusajs/framework/utils");
const points_1 = require("../../points");
// Aggregates the metrics tiers are computed from: lifetime points earned, total
// spend and order count. Not pure (reads the ledger + orders), kept out of the
// pure tier math so `tiers.ts` stays unit-testable.
async function gatherCustomerMetrics(container, customerId) {
    const points = container.resolve(points_1.POINTS_MODULE);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const account = await points.getOrCreateAccount(customerId);
    const earns = (await points.listPointsTransactions({
        account_id: account.id,
        type: 'earn',
    }));
    const lifetimePoints = earns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    let spend = 0;
    let orderCount = 0;
    try {
        const { data: orders } = await query.graph({
            entity: 'order',
            fields: ['total'],
            filters: { customer_id: customerId },
        });
        orderCount = orders.length;
        spend = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    }
    catch {
        // orders not reachable in this context → spend/orders stay 0
    }
    return { points: lifetimePoints, spend, orders: orderCount };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0cmljcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xveWFsdHkvbGliL21ldHJpY3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFRQSxzREErQkM7QUF2Q0QscURBQXNFO0FBQ3RFLHlDQUE2QztBQUk3QyxnRkFBZ0Y7QUFDaEYsK0VBQStFO0FBQy9FLG9EQUFvRDtBQUM3QyxLQUFLLFVBQVUscUJBQXFCLENBQ3pDLFNBQTBDLEVBQzFDLFVBQWtCO0lBRWxCLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsc0JBQWEsQ0FBd0IsQ0FBQztJQUN2RSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLEtBQUssQ0FFOUQsQ0FBQztJQUVGLE1BQU0sT0FBTyxHQUFHLE1BQU0sTUFBTSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVELE1BQU0sS0FBSyxHQUFHLENBQUMsTUFBTSxNQUFNLENBQUMsc0JBQXNCLENBQUM7UUFDakQsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ3RCLElBQUksRUFBRSxNQUFNO0tBQ2IsQ0FBQyxDQUE4QixDQUFDO0lBQ2pDLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRTlFLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNkLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNuQixJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztZQUN6QyxNQUFNLEVBQUUsT0FBTztZQUNmLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQztZQUNqQixPQUFPLEVBQUUsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFO1NBQ3JDLENBQUMsQ0FBQztRQUNILFVBQVUsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQzNCLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsNkRBQTZEO0lBQy9ELENBQUM7SUFFRCxPQUFPLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxDQUFDO0FBQy9ELENBQUMifQ==