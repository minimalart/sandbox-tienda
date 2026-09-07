"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const comments_1 = require("../../../modules/comments");
const resources_1 = require("./resources");
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/comments/site-scope");
// GET /admin/comments — moderation listing with filters + pagination.
// Top-level rows only; each carries a `reply_count` and a `resource` summary
// (producto/artículo comentado) so the table can show what it is about.
async function GET(req, res) {
    const q = req.validatedQuery;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const filters = { parent_id: null };
    if (q.status)
        filters.status = q.status;
    if (q.commentable_type)
        filters.commentable_type = q.commentable_type;
    if (q.commentable_id)
        filters.commentable_id = q.commentable_id;
    if (q.customer_id)
        filters.customer_id = q.customer_id;
    if (q.created_from || q.created_to) {
        const range = {};
        if (q.created_from)
            range.$gte = new Date(q.created_from);
        if (q.created_to)
            range.$lte = new Date(q.created_to);
        filters.created_at = range;
    }
    const limit = q.limit ?? 20;
    const offset = q.offset ?? 0;
    // Al WHERE: la cola de moderación pagina y el contador de pendientes se mira todos
    // los días. Filtrar en memoria lo haría mentir.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.COMMENT_SITE_SCOPE));
    const [comments, count] = await service.listAndCountComments(filters, {
        skip: offset,
        take: limit,
        order: { created_at: 'DESC' },
    });
    // reply counts in a single follow-up query
    const ids = comments.map((c) => c.id);
    const replies = ids.length
        ? await service.listComments({ parent_id: ids }, { take: 10_000, select: ['id', 'parent_id'] })
        : [];
    const replyCount = new Map();
    for (const r of replies) {
        replyCount.set(r.parent_id, (replyCount.get(r.parent_id) ?? 0) + 1);
    }
    // Resúmenes de los productos/artículos comentados, en una query por tipo.
    const rows = comments;
    const resources = await (0, resources_1.loadCommentResources)(req.scope, rows);
    res.status(200).json({
        comments: rows.map((c) => ({
            ...c,
            reply_count: replyCount.get(c.id) ?? 0,
            resource: resources.get((0, resources_1.resourceKey)(c.commentable_type, c.commentable_id)) ?? null,
        })),
        count,
        offset,
        limit,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lbnRzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBYUEsa0JBZ0VDO0FBNUVELHdEQUE0RDtBQUU1RCwyQ0FBZ0U7QUFHaEUsNkRBQWtFO0FBQ2xFLHlEQUEyRDtBQUMzRCxxRUFBMEU7QUFFMUUsc0VBQXNFO0FBQ3RFLDZFQUE2RTtBQUM3RSx3RUFBd0U7QUFDakUsS0FBSyxVQUFVLEdBQUcsQ0FDdkIsR0FBa0IsRUFDbEIsR0FBbUI7SUFFbkIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLGNBQWtELENBQUM7SUFDakUsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXdCLDBCQUFlLENBQUMsQ0FBQztJQUUxRSxNQUFNLE9BQU8sR0FBNEIsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDN0QsSUFBSSxDQUFDLENBQUMsTUFBTTtRQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUN4QyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0I7UUFBRSxPQUFPLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBQ3RFLElBQUksQ0FBQyxDQUFDLGNBQWM7UUFBRSxPQUFPLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQyxjQUFjLENBQUM7SUFDaEUsSUFBSSxDQUFDLENBQUMsV0FBVztRQUFFLE9BQU8sQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQztJQUN2RCxJQUFJLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ25DLE1BQU0sS0FBSyxHQUF5QixFQUFFLENBQUM7UUFDdkMsSUFBSSxDQUFDLENBQUMsWUFBWTtZQUFFLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLENB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