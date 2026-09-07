"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = giftCardOrderCanceled;
const utils_1 = require("@medusajs/framework/utils");
const gift_card_experience_1 = require("../modules/gift-card-experience");
/** Cancels only unissued intents. Official cards already issued remain untouched. */
async function giftCardOrderCanceled({ event, container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const service = container.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
        const canceled = await service.cancelUnissuedDeliveriesForOrder(event.data.id);
        if (canceled > 0) {
            logger.info(`[Gift Card] ${canceled} unissued intent(s) canceled for order ${event.data.id}.`);
        }
    }
    catch (error) {
        logger.error(`[Gift Card] order.canceled reconciliation failed for ${event.data.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.config = { event: 'order.canceled' };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JkZXItY2FuY2VsZWQtZ2lmdC1jYXJkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3N1YnNjcmliZXJzL29yZGVyLWNhbmNlbGVkLWdpZnQtY2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFPQSx3Q0FXQztBQWpCRCxxREFBc0U7QUFFdEUsMEVBQThFO0FBRzlFLHFGQUFxRjtBQUN0RSxLQUFLLFVBQVUscUJBQXFCLENBQUMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFrQztJQUN0RyxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFTLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNFLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7UUFDaEcsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsZ0NBQWdDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMvRSxJQUFJLFFBQVEsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNqQixNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsUUFBUSwwQ0FBMEMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2pHLENBQUM7SUFDSCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMsd0RBQXdELEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbkosQ0FBQztBQUNILENBQUM7QUFFWSxRQUFBLE1BQU0sR0FBcUIsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQyJ9