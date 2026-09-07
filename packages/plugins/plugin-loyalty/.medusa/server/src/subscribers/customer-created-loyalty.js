"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handleLoyaltySignup;
const utils_1 = require("@medusajs/framework/utils");
const loyalty_1 = require("../modules/loyalty");
const earn_loyalty_points_1 = require("../workflows/earn-loyalty-points");
// Awards signup earn rules (event 'signup') when a customer registers. Only
// fixed-amount rules produce points here (amount = 0). Idempotent per customer.
async function handleLoyaltySignup({ event, container, }) {
    const customerId = event.data.id;
    if (!customerId)
        return;
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const loyalty = container.resolve(loyalty_1.LOYALTY_MODULE);
        if (!(await loyalty.getActiveProgram()))
            return;
        const { result } = await (0, earn_loyalty_points_1.earnLoyaltyPointsWorkflow)(container).run({
            input: {
                customer_id: customerId,
                event: 'signup',
                amount: 0,
                reference: 'signup',
                reference_id: customerId,
            },
        });
        const total = (result?.awarded ?? []).reduce((s, a) => s + a.points, 0);
        if (total > 0)
            logger.info(`[Loyalty] Signup: awarded ${total} points to customer ${customerId}.`);
    }
    catch (error) {
        logger.error(`[Loyalty] Failed signup earn for customer ${customerId}: ${error.message}`);
    }
}
exports.config = {
    event: 'customer.created',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VzdG9tZXItY3JlYXRlZC1sb3lhbHR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3N1YnNjcmliZXJzL2N1c3RvbWVyLWNyZWF0ZWQtbG95YWx0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFTQSxzQ0EyQkM7QUFuQ0QscURBQXNFO0FBRXRFLGdEQUFvRDtBQUVwRCwwRUFBNkU7QUFFN0UsNEVBQTRFO0FBQzVFLGdGQUFnRjtBQUNqRSxLQUFLLFVBQVUsbUJBQW1CLENBQUMsRUFDaEQsS0FBSyxFQUNMLFNBQVMsR0FDc0I7SUFDL0IsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDakMsSUFBSSxDQUFDLFVBQVU7UUFBRSxPQUFPO0lBRXhCLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQVMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFM0UsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO1FBQ3hFLElBQUksQ0FBQyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFBRSxPQUFPO1FBRWhELE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUEsK0NBQXlCLEVBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQ2hFLEtBQUssRUFBRTtnQkFDTCxXQUFXLEVBQUUsVUFBVTtnQkFDdkIsS0FBSyxFQUFFLFFBQVE7Z0JBQ2YsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsU0FBUyxFQUFFLFFBQVE7Z0JBQ25CLFlBQVksRUFBRSxVQUFVO2FBQ3pCO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3hFLElBQUksS0FBSyxHQUFHLENBQUM7WUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLDZCQUE2QixLQUFLLHVCQUF1QixVQUFVLEdBQUcsQ0FBQyxDQUFDO0lBQ3JHLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLEtBQUssQ0FBQyw2Q0FBNkMsVUFBVSxLQUFNLEtBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZHLENBQUM7QUFDSCxDQUFDO0FBRVksUUFBQSxNQUFNLEdBQXFCO0lBQ3RDLEtBQUssRUFBRSxrQkFBa0I7Q0FDMUIsQ0FBQyJ9