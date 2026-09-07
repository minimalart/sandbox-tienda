"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("@medusajs/framework/utils");
const points_1 = require("../../../modules/points");
// GET /store/points — the authenticated customer's balance and transaction history.
// Order-referenced transactions are enriched with the order's display_id so the
// storefront can show which purchase generated each movement.
async function GET(req, res) {
    const customerId = req.auth_context.actor_id;
    const service = req.scope.resolve(points_1.POINTS_MODULE);
    const accounts = await service.listPointsAccounts({ customer_id: customerId }, { relations: ['transactions'] });
    const account = accounts[0];
    const transactions = account?.transactions ?? [];
    // Resolve order display_ids for `order` transactions (single batched query).
    const orderIds = [
        ...new Set(transactions
            .filter((t) => t.reference === 'order' && t.reference_id)
            .map((t) => t.reference_id)),
    ];
    const displayById = new Map();
    if (orderIds.length) {
        try {
            const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
            const { data: orders } = await query.graph({
                entity: 'order',
                fields: ['id', 'display_id'],
                filters: { id: orderIds },
            });
            for (const o of orders) {
                displayById.set(o.id, o.display_id);
            }
        }
        catch {
            // Non-fatal: movements still render without the order number.
        }
    }
    const enriched = transactions.map((t) => ({
        ...t,
        order_display_id: t.reference === 'order' && t.reference_id ? (displayById.get(t.reference_id) ?? null) : null,
    }));
    res.status(200).json({
        points: {
            balance: account?.balance ?? 0,
            transactions: enriched,
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3BvaW50cy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWVBLGtCQW9EQztBQWxFRCxxREFBc0U7QUFDdEUsb0RBQXdEO0FBVXhELG9GQUFvRjtBQUNwRixnRkFBZ0Y7QUFDaEYsOERBQThEO0FBQ3ZELEtBQUssVUFBVSxHQUFHLENBQUMsR0FBK0IsRUFBRSxHQUFtQjtJQUM1RSxNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztJQUM3QyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBc0Isc0JBQWEsQ0FBQyxDQUFDO0lBRXRFLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUMvQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsRUFDM0IsRUFBRSxTQUFTLEVBQUUsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUNoQyxDQUFDO0lBQ0YsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FFYixDQUFDO0lBRWQsTUFBTSxZQUFZLEdBQUcsT0FBTyxFQUFFLFlBQVksSUFBSSxFQUFFLENBQUM7SUFFakQsNkVBQTZFO0lBQzdFLE1BQU0sUUFBUSxHQUFHO1FBQ2YsR0FBRyxJQUFJLEdBQUcsQ0FDUixZQUFZO2FBQ1QsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxLQUFLLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDO2FBQ3hELEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQXNCLENBQUMsQ0FDeEM7S0FDRixDQUFDO0lBRUYsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7SUFDOUMsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDO1lBQ0gsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7Z0JBQ3pDLE1BQU0sRUFBRSxPQUFPO2dCQUNmLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxZQUFZLENBQUM7Z0JBQzVCLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUU7YUFDMUIsQ0FBQyxDQUFDO1lBQ0gsS0FBSyxNQUFNLENBQUMsSUFBSSxNQUE4QyxFQUFFLENBQUM7Z0JBQy9ELFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDdEMsQ0FBQztRQUNILENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCw4REFBOEQ7UUFDaEUsQ0FBQztJQUNILENBQUM7SUFFRCxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3hDLEdBQUcsQ0FBQztRQUNKLGdCQUFnQixFQUNkLENBQUMsQ0FBQyxTQUFTLEtBQUssT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7S0FDL0YsQ0FBQyxDQUFDLENBQUM7SUFFSixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNuQixNQUFNLEVBQUU7WUFDTixPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sSUFBSSxDQUFDO1lBQzlCLFlBQVksRUFBRSxRQUFRO1NBQ3ZCO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyJ9