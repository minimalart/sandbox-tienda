import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { COMMENTS_MODULE } from '../../../modules/comments';
import type CommentsModuleService from '../../../modules/comments/service';
import type { CommentableType } from '../../../modules/comments/service';
import { getCustomerName, hasDeliveredPurchase } from './helpers';
import type {
  StoreCreateCommentType,
  StoreListCommentsType,
} from './validators';

import { resolveSite } from '../../../lib/multistore/resolve-site';

type PublicComment = {
  id: string;
  customer_id: string;
  author_name: string | null;
  rating: number | null;
  content: string | null;
  verified_buyer: boolean;
  status: string;
  created_at: Date;
  edited_at: Date | null;
  parent_id: string | null;
  replies?: PublicComment[];
};

// A row is publicly visible if approved, or deleted-with-children (tombstone).
function toPublic(c: Record<string, unknown>): PublicComment {
  return {
    id: c.id as string,
    customer_id: c.customer_id as string,
    author_name: (c.author_name as string) ?? null,
    rating: (c.rating as number) ?? null,
    content: c.status === 'deleted' ? null : ((c.content as string) ?? null),
    verified_buyer: Boolean(c.verified_buyer),
    status: c.status as string,
    created_at: c.created_at as Date,
    edited_at: (c.edited_at as Date) ?? null,
    parent_id: (c.parent_id as string) ?? null,
  };
}

// GET /store/comments?commentable_type=&commentable_id= — public.
// Returns approved comments nested one level (replies under their parent) plus
// an aggregate and the public-facing settings the storefront needs to render.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { commentable_type, commentable_id } =
    req.validatedQuery as unknown as StoreListCommentsType;

  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const settings = await service.getSettings();

  const rows = await service.listComments(
    { commentable_type, commentable_id },
    { take: 10_000, order: { created_at: 'DESC' } },
  );

  // Keep approved rows, plus deleted rows only if they have a parent or children
  // (so a removed comment still shows a tombstone within a thread).
  const byParent = new Map<string, PublicComment[]>();
  const tops: PublicComment[] = [];
  const visible = rows.filter(
    (c: Record<string, unknown>) =>
      c.status === 'approved' || c.status === 'deleted',
  );
  for (const row of visible) {
    const pc = toPublic(row as Record<string, unknown>);
    if (pc.parent_id) {
      const arr = byParent.get(pc.parent_id) ?? [];
      arr.push(pc);
      byParent.set(pc.parent_id, arr);
    } else {
      tops.push(pc);
    }
  }
  const comments = tops
    .map((t) => ({
      ...t,
      replies: (byParent.get(t.id) ?? []).sort(
        (a, b) => +a.created_at - +b.created_at,
      ),
    }))
    // drop deleted top-level comments that have no replies
    .filter((t) => t.status !== 'deleted' || (t.replies?.length ?? 0) > 0);

  const aggregate = await service.getAggregate(
    commentable_type as CommentableType,
    commentable_id,
  );

  res.status(200).json({
    comments,
    aggregate,
    settings: {
      enabled: settings.enabled,
      review_mode: settings.review_mode,
      rating_scale: settings.rating_scale,
      who_can_comment: settings.who_can_comment,
      max_length: settings.max_length,
      min_length: settings.min_length,
    },
  });
}

// POST /store/comments — create a top-level comment (authenticated customer).
export async function POST(
  req: AuthenticatedMedusaRequest<StoreCreateCommentType>,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const body = req.validatedBody;
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const settings = await service.getSettings();

  if (!settings.enabled) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Los comentarios están deshabilitados.',
    );
  }

  // verified_buyer policy (products only): require a DELIVERED order with the
  // product ("ya le entregaron ese producto").
  let verified = false;
  if (settings.who_can_comment === 'verified_buyer') {
    if (body.commentable_type !== 'product') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Solo se pueden comentar productos en este modo.',
      );
    }
    verified = await hasDeliveredPurchase(
      req.scope,
      customerId,
      body.commentable_id,
    );
    if (!verified) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Solo quienes recibieron este producto (pedido entregado) pueden opinar.',
      );
    }
  } else {
    // registered mode: still flag delivered buyers with the "verified" badge.
    if (body.commentable_type === 'product') {
      verified = await hasDeliveredPurchase(
        req.scope,
        customerId,
        body.commentable_id,
      );
    }
  }

  const input = {
    commentable_type: body.commentable_type,
    commentable_id: body.commentable_id,
    customer_id: customerId,
    author_name: await getCustomerName(req.scope, customerId),
    rating: body.rating ?? null,
    content: body.content ?? null,
    verified_buyer: verified,
    /**
     * La tienda sale de la publishable key. Un producto puede estar en VARIAS tiendas,
     * así que el comentario no puede heredar el canal del producto: lo único que dice
     * desde dónde escribió esa persona es la key con la que llegó.
     */
    site_id: await (async () => {
      const channelIds = (req as unknown as {
        publishable_key_context?: { sales_channel_ids?: string[] };
      }).publishable_key_context?.sales_channel_ids;
      const resolution = await resolveSite(req.scope, { salesChannelId: channelIds?.[0] ?? null });
      return resolution.status === 'site' ? resolution.site.id : null;
    })(),
  };

  await service.validateForCreate(input, settings);
  const comment = await service.createCommentModerated(input, settings);

  // Auto-moderated comments are born approved → signal loyalty (best-effort).
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
      ? 'Comentario publicado correctamente.'
      : 'Tu comentario fue enviado y está pendiente de aprobación.';

  res.status(201).json({ comment, message });
}
