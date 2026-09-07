"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.DELETE = DELETE;
const comments_1 = require("../../../../modules/comments");
const resources_1 = require("../resources");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/comments/site-scope");
// GET /admin/comments/:id — detail + replies + `resource` (producto/artículo).
async function GET(req, res) {
    // Todos los handlers: aprobar o borrar la reseña de otra tienda es moderación
    // cruzada, y una reseña borrada no vuelve.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.COMMENT_SITE_SCOPE, req.params.id);
    const id = req.params.id;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const comment = await service.retrieveComment(id).catch(() => null);
    if (!comment) {
        res.status(404).json({ message: 'Comentario no encontrado.' });
        return;
    }
    const replies = await service.listComments({ parent_id: id }, { order: { created_at: 'ASC' } });
    const target = comment;
    const resources = await (0, resources_1.loadCommentResources)(req.scope, [target]);
    res.status(200).json({
        comment: {
            ...comment,
            replies,
            resource: resources.get((0, resources_1.resourceKey)(target.commentable_type, target.commentable_id)) ?? null,
        },
    });
}
// DELETE /admin/comments/:id — soft-delete.
async function DELETE(req, res) {
    // Todos los handlers: aprobar o borrar la reseña de otra tienda es moderación
    // cruzada, y una reseña borrada no vuelve.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.COMMENT_SITE_SCOPE, req.params.id);
    const id = req.params.id;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    await service.softDelete(id);
    res.status(200).json({ id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lbnRzL1tpZF0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFVQSxrQkFtQ0M7QUFHRCx3QkFZQztBQTNERCwyREFBK0Q7QUFFL0QsNENBQWlFO0FBRWpFLGdFQUFxRTtBQUNyRSw0REFBa0U7QUFDbEUsd0VBQTZFO0FBRTdFLCtFQUErRTtBQUN4RSxLQUFLLFVBQVUsR0FBRyxDQUN2QixHQUFrQixFQUNsQixHQUFtQjtJQUVuQiw4RUFBOEU7SUFDOUUsMkNBQTJDO0lBQzNDLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsK0JBQWtCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUV6RyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBRTFFLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2IsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELE9BQU87SUFDVCxDQUFDO0lBQ0QsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsWUFBWSxDQUN4QyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFDakIsRUFBRSxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FDakMsQ0FBQztJQUNGLE1BQU0sTUFBTSxHQUFHLE9BR2QsQ0FBQztJQUNGLE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBQSxnQ0FBb0IsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNsRSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNuQixPQUFPLEVBQUU7WUFDUCxHQUFHLE9BQU87WUFDVixPQUFPO1lBQ1AsUUFBUSxFQUNOLFNBQVMsQ0FBQyxHQUFHLENBQ1gsSUFBQSx1QkFBVyxFQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQzVELElBQUksSUFBSTtTQUNaO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELDRDQUE0QztBQUNyQyxLQUFLLFVBQVUsTUFBTSxDQUMxQixHQUFrQixFQUNsQixHQUFtQjtJQUVuQiw4RUFBOEU7SUFDOUUsMkNBQTJDO0lBQzNDLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsK0JBQWtCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUV6RyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM3QixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUM5QyxDQUFDIn0=