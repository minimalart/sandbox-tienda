import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../../../modules/blog';
import type BlogModuleService from '../../../../../modules/blog/service';

/** POST /admin/blog-posts/:id/duplicate — clone as a fresh draft (incl. products). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
  try {
    const id = req.params.id as string;
    const original = (await service.retrieveBlogPost(id)) as Record<string, any>;

    const slug = await service.ensureUniquePostSlug(`${original.slug}-copy`);

    const blog_post = await service.createBlogPosts({
      title: `Copia de ${original.title}`,
      slug,
      excerpt: original.excerpt ?? null,
      cover_image: original.cover_image ?? null,
      content: original.content ?? null,
      status: 'draft',
      category_id: original.category_id ?? null,
      seo_title: original.seo_title ?? null,
      seo_description: original.seo_description ?? null,
      metadata: original.metadata ?? null,
      published_at: null,
    });

    const productIds = await service.getPostProductIds(id);
    if (productIds.length) {
      await service.setPostProducts(
        (blog_post as { id: string }).id,
        productIds,
      );
    }

    return res.status(201).json({ blog_post });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error duplicating blog post';
    return res.status(400).json({ message });
  }
}
