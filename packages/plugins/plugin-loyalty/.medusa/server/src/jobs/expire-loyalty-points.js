"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = expireLoyaltyPointsJob;
const utils_1 = require("@medusajs/framework/utils");
const points_1 = require("../modules/points");
// Expires loyalty point lots whose `expires_at` has passed. The expiry date is
// stamped at earn time per the program's expiration policy; this job only
// realizes due lots. Idempotent (already-expired lots aren't matched again).
exports.config = {
    name: 'expire-loyalty-points',
    schedule: process.env.LOYALTY_EXPIRE_SCHEDULE || '0 3 * * *', // daily at 03:00
};
async function expireLoyaltyPointsJob(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const points = container.resolve(points_1.POINTS_MODULE);
        const { expired } = await points.expireDueLots(new Date());
        if (expired > 0)
            logger.info(`[Loyalty] Expired ${expired} point lot(s).`);
    }
    catch (error) {
        logger.error(`[Loyalty] expire-loyalty-points failed: ${error.message}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwaXJlLWxveWFsdHktcG9pbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2pvYnMvZXhwaXJlLWxveWFsdHktcG9pbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQWFBLHlDQVNDO0FBckJELHFEQUFzRTtBQUN0RSw4Q0FBa0Q7QUFHbEQsK0VBQStFO0FBQy9FLDBFQUEwRTtBQUMxRSw2RUFBNkU7QUFDaEUsUUFBQSxNQUFNLEdBQUc7SUFDcEIsSUFBSSxFQUFFLHVCQUF1QjtJQUM3QixRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsSUFBSSxXQUFXLEVBQUUsaUJBQWlCO0NBQ2hGLENBQUM7QUFFYSxLQUFLLFVBQVUsc0JBQXNCLENBQUMsU0FBMEI7SUFDN0UsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBUyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRSxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFzQixzQkFBYSxDQUFDLENBQUM7UUFDckUsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLE1BQU0sTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7UUFDM0QsSUFBSSxPQUFPLEdBQUcsQ0FBQztZQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLE9BQU8sZ0JBQWdCLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMsMkNBQTRDLEtBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7QUFDSCxDQUFDIn0=