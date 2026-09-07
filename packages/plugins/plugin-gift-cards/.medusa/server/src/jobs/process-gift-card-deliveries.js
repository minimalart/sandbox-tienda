"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = processGiftCardDeliveries;
const utils_1 = require("@medusajs/framework/utils");
const delivery_1 = require("../modules/gift-card-experience/delivery");
async function processGiftCardDeliveries(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        await (0, delivery_1.processGiftCardDeliveryBatch)(container);
    }
    catch (error) {
        logger.error(`[Gift Card] Delivery outbox failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.config = { name: 'gift-card-delivery-outbox', schedule: '* * * * *' };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1naWZ0LWNhcmQtZGVsaXZlcmllcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9qb2JzL3Byb2Nlc3MtZ2lmdC1jYXJkLWRlbGl2ZXJpZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBSUEsNENBT0M7QUFWRCxxREFBc0U7QUFDdEUsdUVBQXdGO0FBRXpFLEtBQUssVUFBVSx5QkFBeUIsQ0FBQyxTQUEwQjtJQUNoRixNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFTLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNFLElBQUksQ0FBQztRQUNILE1BQU0sSUFBQSx1Q0FBNEIsRUFBQyxTQUFTLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMsdUNBQXVDLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDaEgsQ0FBQztBQUNILENBQUM7QUFFWSxRQUFBLE1BQU0sR0FBRyxFQUFFLElBQUksRUFBRSwyQkFBMkIsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLENBQUMifQ==