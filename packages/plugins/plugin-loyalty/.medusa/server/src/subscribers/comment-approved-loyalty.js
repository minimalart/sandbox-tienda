"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handleLoyaltyCommentApproved;
const utils_1 = require("@medusajs/framework/utils");
const loyalty_1 = require("../modules/loyalty");
const earn_loyalty_points_1 = require("../workflows/earn-loyalty-points");
// Awards `comment` earn rules when a customer's comment/review is approved.
// Only fixed-amount rules produce points (amount = 0). Idempotent per comment
// (the earn workflow keys off `earn:comment:<id>:<rule>`), so re-approving a
// comment never double-credits. The comments module is resolved by its literal
// key so loyalty-engine doesn't hard-depend on the comments extension.
async function handleLoyaltyCommentApproved({ event, container, }) {
    const commentId = event.data.id;
    if (!commentId)
        return;
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const loyalty = container.resolve(loyalty_1.LOYALTY_MODULE);
        if (!(await loyalty.getActiveProgram()))
            return;
        const comments = container.resolve('comments');
        const [comment] = await comments.listComments({ id: commentId });
        if (!comment?.customer_id || comment.status !== 'approved')
            return;
        const { result } = await (0, earn_loyalty_points_1.earnLoyaltyPointsWorkflow)(container).run({
            input: {
                customer_id: comment.customer_id,
                event: 'comment',
                amount: 0,
                reference: 'comment',
                reference_id: commentId,
            },
        });
        const total = (result?.awarded ?? []).reduce((s, a) => s + a.points, 0);
        if (total > 0)
            logger.info(`[Loyalty] Comment ${commentId}: awarded ${total} points.`);
    }
    catch (error) {
        logger.error(`[Loyalty] comment earn failed for ${commentId}: ${error.message}`);
    }
}
exports.config = {
    event: 'comment.approved',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudC1hcHByb3ZlZC1sb3lhbHR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3N1YnNjcmliZXJzL2NvbW1lbnQtYXBwcm92ZWQtbG95YWx0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFZQSwrQ0FpQ0M7QUE1Q0QscURBQXNFO0FBRXRFLGdEQUFvRDtBQUVwRCwwRUFBNkU7QUFFN0UsNEVBQTRFO0FBQzVFLDhFQUE4RTtBQUM5RSw2RUFBNkU7QUFDN0UsK0VBQStFO0FBQy9FLHVFQUF1RTtBQUN4RCxLQUFLLFVBQVUsNEJBQTRCLENBQUMsRUFDekQsS0FBSyxFQUNMLFNBQVMsR0FDc0I7SUFDL0IsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDaEMsSUFBSSxDQUFDLFNBQVM7UUFBRSxPQUFPO0lBRXZCLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQVMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFM0UsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBdUIsd0JBQWMsQ0FBQyxDQUFDO1FBQ3hFLElBQUksQ0FBQyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFBRSxPQUFPO1FBRWhELE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUU1QyxDQUFDO1FBQ0YsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLE1BQU0sUUFBUSxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxPQUFPLEVBQUUsV0FBVyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssVUFBVTtZQUFFLE9BQU87UUFFbkUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSwrQ0FBeUIsRUFBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDaEUsS0FBSyxFQUFFO2dCQUNMLFdBQVcsRUFBRSxPQUFPLENBQUMsV0FBVztnQkFDaEMsS0FBSyxFQUFFLFNBQVM7Z0JBQ2hCLE1BQU0sRUFBRSxDQUFDO2dCQUNULFNBQVMsRUFBRSxTQUFTO2dCQUNwQixZQUFZLEVBQUUsU0FBUzthQUN4QjtTQUNGLENBQUMsQ0FBQztRQUNILE1BQU0sS0FBSyxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN4RSxJQUFJLEtBQUssR0FBRyxDQUFDO1lBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsU0FBUyxhQUFhLEtBQUssVUFBVSxDQUFDLENBQUM7SUFDekYsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxTQUFTLEtBQU0sS0FBZSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDOUYsQ0FBQztBQUNILENBQUM7QUFFWSxRQUFBLE1BQU0sR0FBcUI7SUFDdEMsS0FBSyxFQUFFLGtCQUFrQjtDQUMxQixDQUFDIn0=