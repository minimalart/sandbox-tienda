import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { COMMENTS_MODULE } from '../../../../../modules/comments';
import type CommentsModuleService from '../../../../../modules/comments/service';
import { getCustomerName } from '../../helpers';
import type { StoreReplyCommentType } from '../../validators';

// POST /store/comments/:id/reply — reply to a top-level comment (1 level only).
export async function POST(
  req: AuthenticatedMedusaRequest<StoreReplyCommentType>,
  res: MedusaResponse,
): Promise<void> {
  const id = req.params.id as string;
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const settings = await service.getSettings();

  if (!settings.enabled) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Los comentarios están deshabilitados.',
    );
  }

  const parent = await service.retrieveComment(id).catch(() => null);
  if (!parent || parent.status === 'deleted') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Comentario no encontrado.');
  }
  // One level of nesting: can't reply to a reply.
  if (parent.parent_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'No se permiten respuestas sobre respuestas.',
    );
  }

  const input = {
    commentable_type: parent.commentable_type as 'product' | 'blog_post',
    commentable_id: parent.commentable_id,
    customer_id: customerId,
    author_name: await getCustomerName(req.scope, customerId),
    content: req.validatedBody.content,
    parent_id: parent.id,
  };

  // A reply is always text; validate length + antispam (force 'comment' mode).
  await service.validateForCreate(input, { ...settings, review_mode: 'comment' });
  const comment = await service.createCommentModerated(input, settings);

  if (comment.status === 'approved') {
    try {
      await req.scope
        .resolve(Modules.EVENT_BUS)
        .emit({ name: 'comment.approved', data: { id: comment.id } });
    } catch {
      // loyalty accrual must never block commenting
    }
  }

  const message =
    settings.moderation === 'auto'
      ? 'Respuesta publicada correctamente.'
      : 'Tu respuesta fue enviada y está pendiente de aprobación.';

  res.status(201).json({ comment, message });
}
