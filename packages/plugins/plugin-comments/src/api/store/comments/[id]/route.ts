import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { COMMENTS_MODULE } from '../../../../modules/comments';
import type CommentsModuleService from '../../../../modules/comments/service';
import type { StoreUpdateCommentType } from '../validators';

async function getOwnComment(
  req: AuthenticatedMedusaRequest,
  service: CommentsModuleService,
) {
  const id = req.params.id as string;
  const comment = await service.retrieveComment(id).catch(() => null);
  if (!comment || comment.status === 'deleted') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Comentario no encontrado.');
  }
  if (comment.customer_id !== req.auth_context.actor_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'No podés modificar este comentario.',
    );
  }
  return comment;
}

// PUT /store/comments/:id — edit own comment within the edit window.
export async function PUT(
  req: AuthenticatedMedusaRequest<StoreUpdateCommentType>,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const settings = await service.getSettings();
  const comment = await getOwnComment(req, service);

  const createdAt = new Date(comment.created_at as unknown as string).getTime();
  const windowMs = settings.edit_window_minutes * 60_000;
  if (Date.now() - createdAt > windowMs) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `La ventana de edición de ${settings.edit_window_minutes} minutos expiró.`,
    );
  }

  const body = req.validatedBody;
  await service.validateForCreate(
    {
      commentable_type: comment.commentable_type as 'product' | 'blog_post',
      commentable_id: comment.commentable_id,
      customer_id: comment.customer_id,
      rating: body.rating ?? comment.rating,
      content: body.content ?? comment.content,
    },
    settings,
  );

  const updated = await service.updateComments({
    id: comment.id,
    rating: body.rating ?? comment.rating,
    content: body.content ?? comment.content,
    edited_at: new Date(),
  });

  res.status(200).json({ comment: updated });
}

// DELETE /store/comments/:id — soft-delete own comment.
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const comment = await getOwnComment(req, service);
  await service.softDelete(comment.id);
  res.status(200).json({ id: comment.id, deleted: true });
}
