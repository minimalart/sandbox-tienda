"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const comments_1 = require("../../../modules/comments");
const helpers_1 = require("./helpers");
const resolve_site_1 = require("../../../lib/multistore/resolve-site");
// A row is publicly visible if approved, or deleted-with-children (tombstone).
function toPublic(c) {
    return {
        id: c.id,
        customer_id: c.customer_id,
        author_name: c.author_name ?? null,
        rating: c.rating ?? null,
        content: c.status === 'deleted' ? null : (c.content ?? null),
        verified_buyer: Boolean(c.verified_buyer),
        status: c.status,
        created_at: c.created_at,
        edited_at: c.edited_at ?? null,
        parent_id: c.parent_id ?? null,
    };
}
// GET /store/comments?commentable_type=&commentable_id= — public.
// Returns approved comments nested one level (replies under their parent) plus
// an aggregate and the public-facing settings the storefront needs to render.
async function GET(req, res) {
    const { commentable_type, commentable_id } = req.validatedQuery;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const settings = await service.getSettings();
    const rows = await service.listComments({ commentable_type, commentable_id }, { take: 10_000, order: { created_at: 'DESC' } });
    // Keep approved rows, plus deleted rows only if they have a parent or children
    // (so a removed comment still shows a tombstone within a thread).
    const byParent = new Map();
    const tops = [];
    const visible = rows.filter((c) => c.status === 'approved' || c.status === 'deleted');
    for (const row of visible) {
        const pc = toPublic(row);
        if (pc.parent_id) {
            const arr = byParent.get(pc.parent_id) ?? [];
            arr.push(pc);
            byParent.set(pc.parent_id, arr);
        }
        else {
            tops.push(pc);
        }
    }
    const comments = tops
        .map((t) => ({
        ...t,
        replies: (byParent.get(t.id) ?? []).sort((a, b) => +a.created_at - +b.created_at),
    }))
        // drop deleted top-level comments that have no replies
        .filter((t) => t.status !== 'deleted' || (t.replies?.length ?? 0) > 0);
    const aggregate = await service.getAggregate(commentable_type, commentable_id);
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
async function POST(req, res) {
    const customerId = req.auth_context.actor_id;
    const body = req.validatedBody;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const settings = await service.getSettings();
    if (!settings.enabled) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'Los comentarios están deshabilitados.');
    }
    // verified_buyer policy (products only): require a DELIVERED order with the
    // product ("ya le entregaron ese producto").
    let verified = false;
    if (settings.who_can_comment === 'verified_buyer') {
        if (body.commentable_type !== 'product') {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'Solo se pueden comentar productos en este modo.');
        }
        verified = await (0, helpers_1.hasDeliveredPurchase)(req.scope, customerId, body.commentable_id);
        if (!verified) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'Solo quienes recibieron este producto (pedido entregado) pueden opinar.');
        }
    }
    else {
        // registered mode: still flag delivered buyers with the "verified" badge.
        if (body.commentable_type === 'product') {
            verified = await (0, helpers_1.hasDeliveredPurchase)(req.scope, customerId, body.commentable_id);
        }
    }
    const input = {
        commentable_type: body.commentable_type,
        commentable_id: body.commentable_id,
        customer_id: customerId,
        author_name: await (0, helpers_1.getCustomerName)(req.scope, customerId),
        rating: body.rating ?? null,
        content: body.content ?? null,
        verified_buyer: verified,
        /**
         * La tienda sale de la publishable key. Un producto puede estar en VARIAS tiendas,
         * así que el comentario no puede heredar el canal del producto: lo único que dice
         * desde dónde escribió esa persona es la key con la que llegó.
         */
        site_id: await (async () => {
            const channelIds = req.publishable_key_context?.sales_channel_ids;
            const resolution = await (0, resolve_site_1.resolveSite)(req.scope, { salesChannelId: channelIds?.[0] ?? null });
            return resolution.status === 'site' ? resolution.site.id : null;
        })(),
    };
    await service.validateForCreate(input, settings);
    const comment = await service.createCommentModerated(input, settings);
    // Auto-moderated comments are born approved → signal loyalty (best-effort).
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
        ? 'Comentario publicado correctamente.'
        : 'Tu comentario fue enviado y está pendiente de aprobación.';
    res.status(201).json({ comment, message });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NvbW1lbnRzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBa0RBLGtCQTREQztBQUdELG9CQTBGQztBQXRNRCxxREFBaUU7QUFDakUsd0RBQTREO0FBRzVELHVDQUFrRTtBQU1sRSx1RUFBbUU7QUFnQm5FLCtFQUErRTtBQUMvRSxTQUFTLFFBQVEsQ0FBQyxDQUEwQjtJQUMxQyxPQUFPO1FBQ0wsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFZO1FBQ2xCLFdBQVcsRUFBRSxDQUFDLENBQUMsV0FBcUI7UUFDcEMsV0FBVyxFQUFHLENBQUMsQ0FBQyxXQUFzQixJQUFJLElBQUk7UUFDOUMsTUFBTSxFQUFHLENBQUMsQ0FBQyxNQUFpQixJQUFJLElBQUk7UUFDcEMsT0FBTyxFQUFFLENBQUMsQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLE9BQWtCLElBQUksSUFBSSxDQUFDO1FBQ3hFLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQztRQUN6QyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQWdCO1FBQzFCLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBa0I7UUFDaEMsU0FBUyxFQUFHLENBQUMsQ0FBQyxTQUFrQixJQUFJLElBQUk7UUFDeEMsU0FBUyxFQUFHLENBQUMsQ0FBQyxTQUFvQixJQUFJLElBQUk7S0FDM0MsQ0FBQztBQUNKLENBQUM7QUFFRCxrRUFBa0U7QUFDbEUsK0VBQStFO0FBQy9FLDhFQUE4RTtBQUN2RSxLQUFLLFVBQVUsR0FBRyxDQUN2QixHQUFrQixFQUNsQixHQUFtQjtJQUVuQixNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLEdBQ3hDLEdBQUcsQ0FBQyxjQUFrRCxDQUFDO0lBRXpELE1BQU0sT0FB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