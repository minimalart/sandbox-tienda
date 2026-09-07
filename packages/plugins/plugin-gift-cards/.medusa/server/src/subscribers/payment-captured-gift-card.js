"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = giftCardPaymentCaptured;
const utils_1 = require("@medusajs/framework/utils");
const process_order_1 = require("../modules/gift-card-experience/process-order");
const order_from_payment_1 = require("../utils/order-from-payment");
async function giftCardPaymentCaptured({ event, container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const orderId = await (0, order_from_payment_1.resolveOrderIdFromPayment)(container, event.data.id);
        if (!orderId)
            return; // order.placed performs the race reconciliation.
        await (0, process_order_1.processGiftCardsForOrder)(container, orderId);
    }
    catch (error) {
        logger.error(`[Gift Card] payment.captured processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.config = { event: 'payment.captured' };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bWVudC1jYXB0dXJlZC1naWZ0LWNhcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc3Vic2NyaWJlcnMvcGF5bWVudC1jYXB0dXJlZC1naWZ0LWNhcmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBTUEsMENBU0M7QUFkRCxxREFBc0U7QUFFdEUsaUZBQXlGO0FBQ3pGLG9FQUF3RTtBQUV6RCxLQUFLLFVBQVUsdUJBQXVCLENBQUMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFrQztJQUN4RyxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFTLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNFLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSw4Q0FBeUIsRUFBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU8sQ0FBQyxpREFBaUQ7UUFDdkUsTUFBTSxJQUFBLHdDQUF3QixFQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMsbURBQW1ELEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUgsQ0FBQztBQUNILENBQUM7QUFFWSxRQUFBLE1BQU0sR0FBcUIsRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyJ9