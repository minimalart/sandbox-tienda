"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const comments_1 = require("../../../../../modules/comments");
const helpers_1 = require("../../helpers");
// POST /store/comments/:id/reply — reply to a top-level comment (1 level only).
async function POST(req, res) {
    const id = req.params.id;
    const customerId = req.auth_context.actor_id;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const settings = await service.getSettings();
    if (!settings.enabled) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'Los comentarios están deshabilitados.');
    }
    const parent = await service.retrieveComment(id).catch(() => null);
    if (!parent || parent.status === 'deleted') {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'Comentario no encontrado.');
    }
    // One level of nesting: can't reply to a reply.
    if (parent.parent_id) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'No se permiten respuestas sobre respuestas.');
    }
    const input = {
        commentable_type: parent.commentable_type,
        commentable_id: parent.commentable_id,
        customer_id: customerId,
        author_name: await (0, helpers_1.getCustomerName)(req.scope, customerId),
        content: req.validatedBody.content,
        parent_id: parent.id,
    };
    // A reply is always text; validate length + antispam (force 'comment' mode).
    await service.validateForCreate(input, { ...settings, review_mode: 'comment' });
    const comment = await service.createCommentModerated(input, settings);
    if (comment.status === 'approved') {
        try {
            await req.scope
                .resolve(utils_1.Modules.EVENT_BUS)
                .emit({ name: 'comment.approved', data: { id: comment.id } });
        }
        catch {
            // loyalty accrual must never block commenting
        }
    }
    const message = settings.moderation === 'auto'
        ? 'Respuesta publicada correctamente.'
        : 'Tu respuesta fue enviada y está pendiente de aprobación.';
    res.status(201).json({ comment, message });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NvbW1lbnRzL1tpZF0vcmVwbHkvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFXQSxvQkF5REM7QUFoRUQscURBQWlFO0FBQ2pFLDhEQUFrRTtBQUVsRSwyQ0FBZ0Q7QUFHaEQsZ0ZBQWdGO0FBQ3pFLEtBQUssVUFBVSxJQUFJLENBQ3hCLEdBQXNELEVBQ3RELEdBQW1CO0lBRW5CLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO0lBQzdDLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF3QiwwQkFBZSxDQUFDLENBQUM7SUFDMUUsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7SUFFN0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN0QixNQUFNLElBQUksbUJBQVcsQ0FDbkIsbUJBQVcsQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUM3Qix1Q0FBdUMsQ0FDeEMsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25FLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMzQyxNQUFNLElBQUksbUJBQVcsQ0FBQyxtQkFBVyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBQ0QsZ0RBQWdEO0lBQ2hELElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ3JCLE1BQU0sSUFBSSxtQkFBVyxDQUNuQixtQkFBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQzdCLDZDQUE2QyxDQUM5QyxDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sS0FBSyxHQUFHO1FBQ1osZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUEyQztRQUNwRSxjQUFjLEVBQUUsTUFBTSxDQUFDLGNBQWM7UUFDckMsV0FBVyxFQUFFLFVBQVU7UUFDdkIsV0FBVyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDO1FBQ3pELE9BQU8sRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87UUFDbEMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxFQUFFO0tBQ3JCLENBQUM7SUFFRiw2RUFBNkU7SUFDN0UsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLEVBQUUsR0FBRyxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDaEYsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsc0JBQXNCLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBRXRFLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUNsQyxJQUFJLENBQUM7WUFDSCxNQUFNLEdBQUcsQ0FBQyxLQUFLO2lCQUNaLE9BQU8sQ0FBQyxlQUFPLENBQUMsU0FBUyxDQUFDO2lCQUMxQixJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEUsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLDhDQUE4QztRQUNoRCxDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUNYLFFBQVEsQ0FBQyxVQUFVLEtBQUssTUFBTTtRQUM1QixDQUFDLENBQUMsb0NBQW9DO1FBQ3RDLENBQUMsQ0FBQywwREFBMEQsQ0FBQztJQUVqRSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQzdDLENBQUMifQ==