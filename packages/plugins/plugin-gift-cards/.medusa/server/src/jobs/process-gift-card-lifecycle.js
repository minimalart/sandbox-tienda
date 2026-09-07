"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = processGiftCardLifecycleJob;
const utils_1 = require("@medusajs/framework/utils");
const lifecycle_1 = require("../modules/gift-card-experience/lifecycle");
async function processGiftCardLifecycleJob(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        await (0, lifecycle_1.processGiftCardLifecycle)(container);
    }
    catch (error) {
        logger.error(`[Gift Card] Lifecycle notifications failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.config = { name: 'gift-card-lifecycle-notifications', schedule: '0 10 * * *' };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1naWZ0LWNhcmQtbGlmZWN5Y2xlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2pvYnMvcHJvY2Vzcy1naWZ0LWNhcmQtbGlmZWN5Y2xlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUlBLDhDQU9DO0FBVkQscURBQXNFO0FBQ3RFLHlFQUFxRjtBQUV0RSxLQUFLLFVBQVUsMkJBQTJCLENBQUMsU0FBMEI7SUFDbEYsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBUyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRSxJQUFJLENBQUM7UUFDSCxNQUFNLElBQUEsb0NBQXdCLEVBQUMsU0FBUyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLENBQUMsS0FBSyxDQUFDLCtDQUErQyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3hILENBQUM7QUFDSCxDQUFDO0FBRVksUUFBQSxNQUFNLEdBQUcsRUFBRSxJQUFJLEVBQUUsbUNBQW1DLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxDQUFDIn0=