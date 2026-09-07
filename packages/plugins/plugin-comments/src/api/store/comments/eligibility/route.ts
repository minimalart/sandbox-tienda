import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { COMMENTS_MODULE } from '../../../../modules/comments';
import type CommentsModuleService from '../../../../modules/comments/service';
import { hasDeliveredPurchase } from '../helpers';
import type { StoreListCommentsType } from '../validators';

type Reason =
  | 'ok'
  | 'disabled'
  | 'product_only'
  | 'not_delivered'
  | 'already_reviewed';

// GET /store/comments/eligibility?commentable_type=&commentable_id=
// Authenticated. Tells the storefront whether the current customer can write a
// review for this entity, so it renders the form or an explanatory message.
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const { commentable_type, commentable_id } =
    req.validatedQuery as unknown as StoreListCommentsType;

  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const settings = await service.getSettings();

  const base = {
    logged_in: true,
    review_mode: settings.review_mode,
    rating_scale: settings.rating_scale,
    min_length: settings.min_length,
    max_length: settings.max_length,
    moderation: settings.moderation,
  };

  const respond = (can_review: boolean, reason: Reason) =>
    res.status(200).json({ ...base, can_review, reason });

  if (!settings.enabled) {
    respond(false, 'disabled');
    return;
  }

  // Already left a top-level review for this entity?
  const existing = await service.listComments(
    {
      commentable_type,
      commentable_id,
      customer_id: customerId,
      parent_id: null,
    },
    { take: 1 },
  );
  const alreadyReviewed = existing.some(
    (c: { status: string }) => c.status !== 'deleted',
  );
  if (alreadyReviewed) {
    respond(false, 'already_reviewed');
    return;
  }

  if (settings.who_can_comment === 'verified_buyer') {
    if (commentable_type !== 'product') {
      respond(false, 'product_only');
      return;
    }
    const delivered = await hasDeliveredPurchase(
      req.scope,
      customerId,
      commentable_id,
    );
    if (!delivered) {
      respond(false, 'not_delivered');
      return;
    }
  }

  respond(true, 'ok');
}
