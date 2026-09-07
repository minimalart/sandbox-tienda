"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUT = PUT;
exports.DELETE = DELETE;
const utils_1 = require("@medusajs/framework/utils");
const comments_1 = require("../../../../modules/comments");
async function getOwnComment(req, service) {
    const id = req.params.id;
    const comment = await service.retrieveComment(id).catch(() => null);
    if (!comment || comment.status === 'deleted') {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'Comentario no encontrado.');
    }
    if (comment.customer_id !== req.auth_context.actor_id) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'No podés modificar este comentario.');
    }
    return comment;
}
// PUT /store/comments/:id — edit own comment within the edit window.
async function PUT(req, res) {
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const settings = await service.getSettings();
    const comment = await getOwnComment(req, service);
    const createdAt = new Date(comment.created_at).getTime();
    const windowMs = settings.edit_window_minutes * 60_000;
    if (Date.now() - createdAt > windowMs) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, `La ventana de edición de ${settings.edit_window_minutes} minutos expiró.`);
    }
    const body = req.validatedBody;
    await service.validateForCreate({
        commentable_type: comment.commentable_type,
        commentable_id: comment.commentable_id,
        customer_id: comment.customer_id,
        rating: body.rating ?? comment.rating,
        content: body.content ?? comment.content,
    }, settings);
    const updated = await service.updateComments({
        id: comment.id,
        rating: body.rating ?? comment.rating,
        content: body.content ?? comment.content,
        edited_at: new Date(),
    });
    res.status(200).json({ comment: updated });
}
// DELETE /store/comments/:id — soft-delete own comment.
async function DELETE(req, res) {
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const comment = await getOwnComment(req, service);
    await service.softDelete(comment.id);
    res.status(200).json({ id: comment.id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NvbW1lbnRzL1tpZF0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUE0QkEsa0JBcUNDO0FBR0Qsd0JBUUM7QUF4RUQscURBQXdEO0FBQ3hELDJEQUErRDtBQUkvRCxLQUFLLFVBQVUsYUFBYSxDQUMxQixHQUErQixFQUMvQixPQUE4QjtJQUU5QixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3BFLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUM3QyxNQUFNLElBQUksbUJBQVcsQ0FBQyxtQkFBVyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBQ0QsSUFBSSxPQUFPLENBQUMsV0FBVyxLQUFLLEdBQUcsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDdEQsTUFBTSxJQUFJLG1CQUFXLENBQ25CLG1CQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFDN0IscUNBQXFDLENBQ3RDLENBQUM7SUFDSixDQUFDO0lBQ0QsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUVELHFFQUFxRTtBQUM5RCxLQUFLLFVBQVUsR0FBRyxDQUN2QixHQUF1RCxFQUN2RCxHQUFtQjtJQUVuQixNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQzdDLE1BQU0sT0FBTyxHQUFHLE1BQU0sYUFBYSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUVsRCxNQUFNLFNBQVMsR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBK0IsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzlFLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxtQkFBbUIsR0FBRyxNQUFNLENBQUM7SUFDdkQsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUyxHQUFHLFFBQVEsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxtQkFBVyxDQUNuQixtQkFBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQzdCLDRCQUE0QixRQUFRLENBQUMsbUJBQW1CLGtCQUFrQixDQUMzRSxDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUM7SUFDL0IsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQzdCO1FBQ0UsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLGdCQUEyQztRQUNyRSxjQUFjLEVBQUUsT0FBTyxDQUFDLGNBQWM7UUFDdEMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxXQUFXO1FBQ2hDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNO1FBQ3JDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPO0tBQ3pDLEVBQ0QsUUFBUSxDQUNULENBQUM7SUFFRixNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxjQUFjLENBQUM7UUFDM0MsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ2QsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDLE1BQU07UUFDckMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU87UUFDeEMsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFO0tBQ3RCLENBQUMsQ0FBQztJQUVILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUVELHdEQUF3RDtBQUNqRCxLQUFLLFVBQVUsTUFBTSxDQUMxQixHQUErQixFQUMvQixHQUFtQjtJQUVuQixNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sT0FBTyxHQUFHLE1BQU0sYUFBYSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNsRCxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3JDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDMUQsQ0FBQyJ9