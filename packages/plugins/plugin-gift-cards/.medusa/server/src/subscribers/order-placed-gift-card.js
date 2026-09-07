"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = giftCardOrderPlaced;
const utils_1 = require("@medusajs/framework/utils");
const process_order_1 = require("../modules/gift-card-experience/process-order");
/** Creates idempotent intents and reconciles the capture-before-order race. */
async function giftCardOrderPlaced({ event, container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const result = await (0, process_order_1.processGiftCardsForOrder)(container, event.data.id);
        if (result.intentCount > 0) {
            logger.info(`[Gift Card] ${result.intentCount} intent(s) reconciled for order ${event.data.id}; paid=${result.paid}.`);
        }
    }
    catch (error) {
        logger.error(`[Gift Card] order.placed reconciliation failed for ${event.data.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.config = { event: 'order.placed' };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JkZXItcGxhY2VkLWdpZnQtY2FyZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zdWJzY3JpYmVycy9vcmRlci1wbGFjZWQtZ2lmdC1jYXJkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQU1BLHNDQVVDO0FBZkQscURBQXNFO0FBRXRFLGlGQUF5RjtBQUV6RiwrRUFBK0U7QUFDaEUsS0FBSyxVQUFVLG1CQUFtQixDQUFDLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBa0M7SUFDcEcsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBUyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRSxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsd0NBQXdCLEVBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEUsSUFBSSxNQUFNLENBQUMsV0FBVyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxNQUFNLENBQUMsV0FBVyxtQ0FBbUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7UUFDekgsQ0FBQztJQUNILENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLEtBQUssQ0FBQyxzREFBc0QsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNqSixDQUFDO0FBQ0gsQ0FBQztBQUVZLFFBQUEsTUFBTSxHQUFxQixFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsQ0FBQyJ9