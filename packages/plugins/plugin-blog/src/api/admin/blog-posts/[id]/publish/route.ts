import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../../../modules/blog';
import type BlogModuleService from '../../../../../modules/blog/service';

/** POST /admin/blog-posts/:id/publish — set status=published + stamp published_at. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const id = req.params.id as string;
    const current = await service.retrieveBlogPost(id);
    const blog_post = await service.updateBlogPosts({
      id,
      status: 'published',
      published_at:
        (current as { published_at?: Date }).published_at ?? new Date(),
    });
    return res.status(200).json({ blog_post });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error publishing blog post';
    return res.status(400).json({ message });
  }
}
