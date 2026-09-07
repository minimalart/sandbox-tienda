import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../modules/blog';
import type BlogModuleService from '../../../modules/blog/service';

/** GET /store/blog-settings — public presentation config for the blog section. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const s = (await service.getSettings()) as Record<string, any>;
    return res.status(200).json({
      blog_settings: {
        section_name: s.section_name ?? 'Blog',
        show_search: s.show_search ?? true,
        show_categories: s.show_categories ?? true,
        posts_per_page: s.posts_per_page ?? 12,
        default_seo_title: s.default_seo_title ?? null,
        default_seo_description: s.default_seo_description ?? null,
      },
    });
  } catch (error) {
    console.error('[Store BlogSettings] Error:', error);
    return res.status(200).json({
      blog_settings: {
        section_name: 'Blog',
        show_search: true,
        show_categories: true,
        posts_per_page: 12,
        default_seo_title: null,
        default_seo_description: null,
      },
    });
  }
}
