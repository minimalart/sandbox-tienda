import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { COMMENTS_MODULE } from '../../../modules/comments';
import type CommentsModuleService from '../../../modules/comments/service';
import { loadCommentResources, resourceKey } from './resources';
import type { AdminListCommentsType } from './validators';

import { siteFromRequest } from '../../../lib/multistore/request';
import { siteFilter } from '../../../lib/multistore/scope';
import { COMMENT_SITE_SCOPE } from '../../../modules/comments/site-scope';

// GET /admin/comments — moderation listing with filters + pagination.
// Top-level rows only; each carries a `reply_count` and a `resource` summary
// (producto/artículo comentado) so the table can show what it is about.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const q = req.validatedQuery as unknown as AdminListCommentsType;
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);

  const filters: Record<string, unknown> = { parent_id: null };
  if (q.status) filters.status = q.status;
  if (q.commentable_type) filters.commentable_type = q.commentable_type;
  if (q.commentable_id) filters.commentable_id = q.commentable_id;
  if (q.customer_id) filters.customer_id = q.customer_id;
  if (q.created_from || q.created_to) {
    const range: Record<string, Date> = {};
    if (q.created_from) range.$gte = new Date(q.created_from);
    if (q.created_to) range.$lte = new Date(q.created_to);
    filters.created_at = range;
  }

  const limit = q.limit ?? 20;
  const offset = q.offset ?? 0;

  // Al WHERE: la cola de moderación pagina y el contador de pendientes se mira todos
  // los días. Filtrar en memoria lo haría mentir.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), COMMENT_SITE_SCOPE));

  const [comments, count] = await service.listAndCountComments(filters, {
    skip: offset,
    take: limit,
    order: { created_at: 'DESC' },
  });

  // reply counts in a single follow-up query
  const ids = comments.map((c: { id: string }) => c.id);
  const replies = ids.length
    ? await service.listComments(
        { parent_id: ids },
        { take: 10_000, select: ['id', 'parent_id'] },
      )
    : [];
  const replyCount = new Map<string, number>();
  for (const r of replies as { parent_id: string }[]) {
    replyCount.set(r.parent_id, (replyCount.get(r.parent_id) ?? 0) + 1);
  }

  // Resúmenes de los productos/artículos comentados, en una query por tipo.
  const rows = comments as {
    id: string;
    commentable_type: string;
    commentable_id: string;
  }[];
  const resources = await loadCommentResources(req.scope, rows);

  res.status(200).json({
    comments: rows.map((c) => ({
      ...c,
      reply_count: replyCount.get(c.id) ?? 0,
      resource:
        resources.get(resourceKey(c.commentable_type, c.commentable_id)) ?? null,
    })),
    count,
    offset,
    limit,
  });
}
