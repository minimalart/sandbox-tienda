"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handleLoyaltyOrderCanceled;
const utils_1 = require("@medusajs/framework/utils");
const reverse_loyalty_points_1 = require("../workflows/reverse-loyalty-points");
// A canceled order claws back the points it earned. Idempotent (keys off each
// original earn txn), so a duplicate event never double-reverses.
async function handleLoyaltyOrderCanceled({ event, container, }) {
    const orderId = event.data.id;
    if (!orderId)
        return;
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
        entity: 'order',
        fields: ['id', 'customer_id'],
        filters: { id: orderId },
    }));
    const order = orders[0];
    if (!order?.customer_id)
        return;
    try {
        const { result } = await (0, reverse_loyalty_points_1.reverseLoyaltyPointsWorkflow)(container).run({
            input: { customer_id: order.customer_id, reference: 'order', reference_id: order.id },
        });
        logger.info(`[Loyalty] Order ${order.id} canceled: reversed ${result?.reversed ?? 0} points.`);
    }
    catch (error) {
        logger.error(`[Loyalty] Failed to reverse points for canceled order ${order.id}: ${error.message}`);
    }
}
exports.config = {
    event: 'order.canceled',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JkZXItY2FuY2VsZWQtbG95YWx0eS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zdWJzY3JpYmVycy9vcmRlci1jYW5jZWxlZC1sb3lhbHR5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQU9BLDZDQTZCQztBQW5DRCxxREFBc0U7QUFFdEUsZ0ZBQW1GO0FBRW5GLDhFQUE4RTtBQUM5RSxrRUFBa0U7QUFDbkQsS0FBSyxVQUFVLDBCQUEwQixDQUFDLEVBQ3ZELEtBQUssRUFDTCxTQUFTLEdBQ3NCO0lBQy9CLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO0lBQzlCLElBQUksQ0FBQyxPQUFPO1FBQUUsT0FBTztJQUVyQixNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFTLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNFLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBRTVCLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXBDLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDMUMsTUFBTSxFQUFFLE9BQU87UUFDZixNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDO1FBQzdCLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7S0FDekIsQ0FBQyxDQUFnRSxDQUFDO0lBRW5FLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4QixJQUFJLENBQUMsS0FBSyxFQUFFLFdBQVc7UUFBRSxPQUFPO0lBRWhDLElBQUksQ0FBQztRQUNILE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUEscURBQTRCLEVBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQ25FLEtBQUssRUFBRSxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7U0FDdEYsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxDQUFDLEVBQUUsdUJBQXVCLE1BQU0sRUFBRSxRQUFRLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMseURBQXlELEtBQUssQ0FBQyxFQUFFLEtBQU0sS0FBZSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDakgsQ0FBQztBQUNILENBQUM7QUFFWSxRQUFBLE1BQU0sR0FBcUI7SUFDdEMsS0FBSyxFQUFFLGdCQUFnQjtDQUN4QixDQUFDIn0=