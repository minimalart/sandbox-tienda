import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { COMMENTS_MODULE } from '../../../../modules/comments';
import type CommentsModuleService from '../../../../modules/comments/service';
import { loadCommentResources, resourceKey } from '../resources';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { COMMENT_SITE_SCOPE } from '../../../../modules/comments/site-scope';

// GET /admin/comments/:id — detail + replies + `resource` (producto/artículo).
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // Todos los handlers: aprobar o borrar la reseña de otra tienda es moderación
  // cruzada, y una reseña borrada no vuelve.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMMENT_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);

  const comment = await service.retrieveComment(id).catch(() => null);
  if (!comment) {
    res.status(404).json({ message: 'Comentario no encontrado.' });
    return;
  }
  const replies = await service.listComments(
    { parent_id: id },
    { order: { created_at: 'ASC' } },
  );
  const target = comment as unknown as {
    commentable_type: string;
    commentable_id: string;
  };
  const resources = await loadCommentResources(req.scope, [target]);
  res.status(200).json({
    comment: {
      ...comment,
      replies,
      resource:
        resources.get(
          resourceKey(target.commentable_type, target.commentable_id),
        ) ?? null,
    },
  });
}

// DELETE /admin/comments/:id — soft-delete.
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // Todos los handlers: aprobar o borrar la reseña de otra tienda es moderación
  // cruzada, y una reseña borrada no vuelve.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMMENT_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  await service.softDelete(id);
  res.status(200).json({ id, deleted: true });
}
