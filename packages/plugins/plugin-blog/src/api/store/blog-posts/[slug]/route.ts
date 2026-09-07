import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../../modules/blog';
import type BlogModuleService from '../../../../modules/blog/service';
import {
  toPublicBlogPost,
  toPublicBlogCard,
  isPostInSalesChannel,
  readStrictFlag,
} from '../helpers';

/**
 * GET /store/blog-posts/:slug — public, single PUBLISHED post by slug, plus its
 * ordered product ids and up to 4 related posts (same category). 404 when not
 * found/published. `?preview=true` also resolves drafts (used by the admin's
 * "Vista previa"); guard behind the admin in production if drafts are sensitive.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const preview =
      req.query.preview === 'true' || req.query.preview === '1';
    const salesChannelId =
      typeof req.query.sales_channel_id === 'string'
        ? req.query.sales_channel_id
        : undefined;
    const strict = readStrictFlag(req.query);

    const filters: Record<string, unknown> = { slug: req.params.slug };
    if (!preview) {
      filters.status = 'published';
    }

    const [post] = await service.listBlogPosts(filters, { take: 1 });
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    // El artículo no debe abrirse por URL directa en un canal donde no es
    // visible (p.ej. un artículo scopeado a una demo, en el store principal).
    // La preview del admin (sin canal) siempre pasa.
    if (
      !preview &&
      !isPostInSalesChannel(post as Record<string, any>, salesChannelId, strict)
    ) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    const product_ids = await service.getPostProductIds(
      (post as { id: string }).id,
    );

    let related: Record<string, any>[] = [];
    if ((post as { category_id?: string }).category_id) {
      const candidates = await service.listBlogPosts(
        {
          status: 'published',
          category_id: (post as { category_id: string }).category_id,
        },
        { take: 20, order: { published_at: 'DESC' } },
      );
      related = (candidates as Record<string, any>[])
        .filter((p) => p.id !== (post as { id: string }).id)
        // Solo relacionados visibles en el canal que pide (ver isPostInSalesChannel).
        .filter((p) => isPostInSalesChannel(p, salesChannelId, strict))
        .slice(0, 4)
        .map(toPublicBlogCard);
    }

    return res.status(200).json({
      blog_post: toPublicBlogPost(post as Record<string, any>),
      product_ids,
      related_posts: related,
    });
  } catch (error) {
    console.error('[Store BlogPosts] Error fetching post:', error);
    return res.status(404).json({ message: 'Blog post not found' });
  }
}
