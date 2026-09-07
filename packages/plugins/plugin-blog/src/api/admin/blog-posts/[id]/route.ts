import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../../modules/blog';
import type BlogModuleService from '../../../../modules/blog/service';
import { PostAdminUpdateBlogPost } from '../validators';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../lib/multistore/scope';
import { BLOG_POST_SITE_SCOPE } from '../../../../modules/blog/site-scope';

/** GET /admin/blog-posts/:id — retrieve a post + its ordered product ids. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
  try {
    const id = req.params.id as string;
    const blog_post = await service.retrieveBlogPost(id);
    assertRowInSite(blog_post as Record<string, unknown>, await siteFromRequest(req), BLOG_POST_SITE_SCOPE);
    const product_ids = await service.getPostProductIds(id);
    return res.status(200).json({ blog_post, product_ids });
  } catch {
    return res.status(404).json({ message: 'Blog post not found' });
  }
}

/** POST /admin/blog-posts/:id — partial update. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminUpdateBlogPost.parse(req.body);
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const id = req.params.id as string;

    const { slug, ...rest } = validated;
    const next: Record<string, unknown> = { id, ...rest };

    if (slug !== undefined) {
      next.slug = await service.ensureUniquePostSlug(slug, id);
    }
    // When transitioning to published and no published_at yet, stamp it.
    if (validated.status === 'published') {
      const current = await service.retrieveBlogPost(id);
      if (!(current as { published_at?: unknown }).published_at) {
        next.published_at = new Date();
      }
    }

    assertRowInSite(
      (await service.retrieveBlogPost(id)) as Record<string, unknown>,
      await siteFromRequest(req),
      BLOG_POST_SITE_SCOPE,
    );

    const blog_post = await service.updateBlogPosts(next);
    return res.status(200).json({ blog_post });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating blog post';
    console.error('[Admin BlogPosts] Error updating post:', message);
    return res.status(400).json({ message });
  }
}

/** DELETE /admin/blog-posts/:id — soft-delete (and its product links). */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
  try {
    const id = req.params.id as string;
    await service.setPostProducts(id, []);
    assertRowInSite(
      (await service.retrieveBlogPost(id)) as Record<string, unknown>,
      await siteFromRequest(req),
      BLOG_POST_SITE_SCOPE,
    );

    await service.softDeleteBlogPosts(id);
    return res
      .status(200)
      .json({ id, object: 'blog_post', deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error deleting blog post';
    return res.status(400).json({ message });
  }
}
