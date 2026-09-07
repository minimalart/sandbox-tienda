import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../modules/blog';
import type BlogModuleService from '../../../modules/blog/service';
import { PostAdminCreateBlogPost } from './validators';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteFilter, siteDefaults } from '../../../lib/multistore/scope';
import { BLOG_POST_SITE_SCOPE } from '../../../modules/blog/site-scope';

/**
 * GET /admin/blog-posts — paginated list (limit, offset, status, category_id, q).
 * `q` matches title/excerpt/slug case-insensitively. Newest first.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    const category_id =
      typeof req.query.category_id === 'string'
        ? req.query.category_id
        : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const [blog_posts, count] = await service.searchPosts(q, {
      status,
      category_id,
      limit,
      offset,
      extraFilters: await siteFilter(req.scope, await siteFromRequest(req), BLOG_POST_SITE_SCOPE),
    });

    return res.status(200).json({ blog_posts, count, limit, offset });
  } catch (error) {
    console.error('[Admin BlogPosts] Error listing posts:', error);
    return res.status(500).json({ message: 'Error fetching blog posts' });
  }
}

/** POST /admin/blog-posts — create a post. Slug generated from title when omitted. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminCreateBlogPost.parse(req.body);
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);

    const slug = await service.ensureUniquePostSlug(
      validated.slug || validated.title,
    );

    // Sin canales explícitos, el post nace en la tienda activa.
    const channels =
      (validated as { sales_channel_ids?: unknown }).sales_channel_ids === undefined
        ? siteDefaults(await siteFromRequest(req), BLOG_POST_SITE_SCOPE)
        : {};

    const blog_post = await service.createBlogPosts({
      ...validated,
      ...channels,
      slug,
      cover_image: (validated.cover_image ?? null) as Record<
        string,
        unknown
      > | null,
      content: (validated.content ?? null) as Record<string, unknown> | null,
      // sales_channel_ids: array en columna model.json() (tipada como Record).
      sales_channel_ids: (validated.sales_channel_ids ?? null) as any,
      published_at:
        validated.status === 'published' ? new Date() : null,
    });

    return res.status(201).json({ blog_post });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error creating blog post';
    console.error('[Admin BlogPosts] Error creating post:', message);
    return res.status(400).json({ message });
  }
}
