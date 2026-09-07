import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../../../modules/blog';
import type BlogModuleService from '../../../../../modules/blog/service';

/** POST /admin/blog-posts/:id/unpublish — revert to draft (keeps published_at). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const blog_post = await service.updateBlogPosts({
      id: req.params.id as string,
      status: 'draft',
    });
    return res.status(200).json({ blog_post });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error unpublishing blog post';
    return res.status(400).json({ message });
  }
}
