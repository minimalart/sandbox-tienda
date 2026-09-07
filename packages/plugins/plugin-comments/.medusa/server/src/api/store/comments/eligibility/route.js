"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const comments_1 = require("../../../../modules/comments");
const helpers_1 = require("../helpers");
// GET /store/comments/eligibility?commentable_type=&commentable_id=
// Authenticated. Tells the storefront whether the current customer can write a
// review for this entity, so it renders the form or an explanatory message.
async function GET(req, res) {
    const customerId = req.auth_context.actor_id;
    const { commentable_type, commentable_id } = req.validatedQuery;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const settings = await service.getSettings();
    const base = {
        logged_in: true,
        review_mode: settings.review_mode,
        rating_scale: settings.rating_scale,
        min_length: settings.min_length,
        max_length: settings.max_length,
        moderation: settings.moderation,
    };
    const respond = (can_review, reason) => res.status(200).json({ ...base, can_review, reason });
    if (!settings.enabled) {
        respond(false, 'disabled');
        return;
    }
    // Already left a top-level review for this entity?
    const existing = await service.listComments({
        commentable_type,
        commentable_id,
        customer_id: customerId,
        parent_id: null,
    }, { take: 1 });
    const alreadyReviewed = existing.some((c) => c.status !== 'deleted');
    if (alreadyReviewed) {
        respond(false, 'already_reviewed');
        return;
    }
    if (settings.who_can_comment === 'verified_buyer') {
        if (commentable_type !== 'product') {
            respond(false, 'product_only');
            return;
        }
        const delivered = await (0, helpers_1.hasDeliveredPurchase)(req.scope, customerId, commentable_id);
        if (!delivered) {
            respond(false, 'not_delivered');
            return;
        }
    }
    respond(true, 'ok');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NvbW1lbnRzL2VsaWdpYmlsaXR5L3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBbUJBLGtCQStEQztBQTlFRCwyREFBK0Q7QUFFL0Qsd0NBQWtEO0FBVWxELG9FQUFvRTtBQUNwRSwrRUFBK0U7QUFDL0UsNEVBQTRFO0FBQ3JFLEtBQUssVUFBVSxHQUFHLENBQ3ZCLEdBQStCLEVBQy9CLEdBQW1CO0lBRW5CLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO0lBQzdDLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsR0FDeEMsR0FBRyxDQUFDLGNBQWtELENBQUM7SUFFekQsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXdCLDBCQUFlLENBQUMsQ0FBQztJQUMxRSxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUU3QyxNQUFNLElBQUksR0FBRztRQUNYLFNBQVMsRUFBRSxJQUFJO1FBQ2YsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXO1FBQ2pDLFlBQVksRUFBRSxRQUFRLENBQUMsWUFBWTtRQUNuQyxVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVU7UUFDL0IsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO1FBQy9CLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVTtLQUNoQyxDQUFDO0lBRUYsTUFBTSxPQUFPLEdBQUcsQ0FBQyxVQUFtQixFQUFFLE1BQWMsRUFBRSxFQUFFLENBQ3RELEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFFeEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN0QixPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzNCLE9BQU87SUFDVCxDQUFDO0lBRUQsbURBQW1EO0lBQ25ELE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FDekM7UUFDRSxnQkFBZ0I7UUFDaEIsY0FBYztRQUNkLFdBQVcsRUFBRSxVQUFVO1FBQ3ZCLFNBQVMsRUFBRSxJQUFJO0tBQ2hCLEVBQ0QsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQ1osQ0FBQztJQUNGLE1BQU0sZUFBZSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQ25DLENBQUMsQ0FBcUIsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQ2xELENBQUM7SUFDRixJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3BCLE9BQU8sQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNuQyxPQUFPO0lBQ1QsQ0FBQztJQUVELElBQUksUUFBUSxDQUFDLGVBQWUsS0FBSyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ2xELElBQUksZ0JBQWdCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDbkMsT0FBTyxDQUFDLEtBQUssRUFBRSxjQUFjLENBQUMsQ0FBQztZQUMvQixPQUFPO1FBQ1QsQ0FBQztRQUNELE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBQSw4QkFBb0IsRUFDMUMsR0FBRyxDQUFDLEtBQUssRUFDVCxVQUFVLEVBQ1YsY0FBYyxDQUNmLENBQUM7UUFDRixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ2hDLE9BQU87UUFDVCxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDdEIsQ0FBQyJ9