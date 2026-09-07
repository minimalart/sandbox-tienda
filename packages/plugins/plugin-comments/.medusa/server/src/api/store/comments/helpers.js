"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerName = getCustomerName;
exports.hasDeliveredPurchase = hasDeliveredPurchase;
const utils_1 = require("@medusajs/framework/utils");
/** Display name snapshot for a customer ("First Last" / email fallback). */
async function getCustomerName(container, customerId) {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data } = (await query.graph({
        entity: 'customer',
        fields: ['first_name', 'last_name', 'email'],
        filters: { id: customerId },
    }));
    const c = data[0];
    if (!c)
        return null;
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
    return name || c.email || null;
}
/**
 * Returns true when the customer has received (delivered) the given product:
 * an order containing the product where the matching line item belongs to a
 * fulfillment that has been marked delivered (`delivered_at` set). This is the
 * "pedido entregado" gate for writing reviews — stricter than just "paid".
 */
async function hasDeliveredPurchase(container, customerId, productId) {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data } = (await query.graph({
        entity: 'order',
        fields: [
            'id',
            'items.id',
            'items.product_id',
            'fulfillments.delivered_at',
            'fulfillments.items.line_item_id',
        ],
        filters: { customer_id: customerId },
    }));
    for (const order of data) {
        // Line items that are part of a delivered fulfillment.
        const deliveredLineItemIds = new Set();
        for (const f of order.fulfillments ?? []) {
            if (!f.delivered_at)
                continue;
            for (const fi of f.items ?? []) {
                deliveredLineItemIds.add(fi.line_item_id);
            }
        }
        if (deliveredLineItemIds.size === 0)
            continue;
        // The target product must be one of those delivered line items.
        const delivered = (order.items ?? []).some((it) => it.product_id === productId && deliveredLineItemIds.has(it.id));
        if (delivered)
            return true;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvc3RvcmUvY29tbWVudHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVFBLDBDQWNDO0FBUUQsb0RBNkNDO0FBM0VELHFEQUFzRTtBQU90RSw0RUFBNEU7QUFDckUsS0FBSyxVQUFVLGVBQWUsQ0FDbkMsU0FBMEIsRUFDMUIsVUFBa0I7SUFFbEIsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBWSxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1RSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDbEMsTUFBTSxFQUFFLFVBQVU7UUFDbEIsTUFBTSxFQUFFLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUM7UUFDNUMsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLFVBQVUsRUFBRTtLQUM1QixDQUFDLENBQTRFLENBQUM7SUFDL0UsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLElBQUksQ0FBQyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDcEIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzFFLE9BQU8sSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDO0FBQ2pDLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxvQkFBb0IsQ0FDeEMsU0FBMEIsRUFDMUIsVUFBa0IsRUFDbEIsU0FBaUI7SUFFakIsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBWSxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1RSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDbEMsTUFBTSxFQUFFLE9BQU87UUFDZixNQUFNLEVBQUU7WUFDTixJQUFJO1lBQ0osVUFBVTtZQUNWLGtCQUFrQjtZQUNsQiwyQkFBMkI7WUFDM0IsaUNBQWlDO1NBQ2xDO1FBQ0QsT0FBTyxFQUFFLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRTtLQUNyQyxDQUFDLENBVUQsQ0FBQztJQUVGLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxFQUFFLENBQUM7UUFDekIsdURBQXVEO1FBQ3ZELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUMvQyxLQUFLLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxZQUFZLElBQUksRUFBRSxFQUFFLENBQUM7WUFDekMsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZO2dCQUFFLFNBQVM7WUFDOUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUMvQixvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzVDLENBQUM7UUFDSCxDQUFDO1FBQ0QsSUFBSSxvQkFBb0IsQ0FBQyxJQUFJLEtBQUssQ0FBQztZQUFFLFNBQVM7UUFDOUMsZ0VBQWdFO1FBQ2hFLE1BQU0sU0FBUyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQ3hDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsVUFBVSxLQUFLLFNBQVMsSUFBSSxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUN2RSxDQUFDO1FBQ0YsSUFBSSxTQUFTO1lBQUUsT0FBTyxJQUFJLENBQUM7SUFDN0IsQ0FBQztJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyJ9