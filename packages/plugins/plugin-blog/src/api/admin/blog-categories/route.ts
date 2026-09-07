import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../modules/blog';
import type BlogModuleService from '../../../modules/blog/service';
import { PostAdminCreateBlogCategory } from './validators';

import { siteFromRequest } from '../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { BLOG_CATEGORY_SITE_SCOPE } from '../../../modules/blog/site-scope';

/** GET /admin/blog-categories — list ordered by sort_order then name. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const filters: Record<string, unknown> = {};
    if (q) {
      filters.$or = [
        { name: { $ilike: `%${q}%` } },
        { slug: { $ilike: `%${q}%` } },
      ];
    }

    const resolution = await siteFromRequest(req);
    const siteWhere = await siteFilter(req.scope, resolution, BLOG_CATEGORY_SITE_SCOPE);

    const [blog_categories, count] = await service.listAndCountBlogCategories(
      { ...(filters), ...siteWhere },
      { skip: offset, take: limit, order: { sort_order: 'ASC', name: 'ASC' } },
    );

    return res.status(200).json({ blog_categories, count, limit, offset });
  } catch (error) {
    console.error('[Admin BlogCategories] Error listing categories:', error);
    return res.status(500).json({ message: 'Error fetching blog categories' });
  }
}

/** POST /admin/blog-categories — create. Slug generated from name when omitted. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminCreateBlogCategory.parse(req.body);
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const slug = await service.ensureUniqueCategorySlug(
      validated.slug || validated.name,
    );
    // La categoría nace en la tienda activa: si no, se crea desde una y aparece en
    // todas, y el listado filtrado ya no la encuentra donde se creó.
    const blog_category = await service.createBlogCategories({
      ...siteDefaults(await siteFromRequest(req), BLOG_CATEGORY_SITE_SCOPE),
      ...validated,
      slug,
      image: (validated.image ?? null) as Record<string, unknown> | null,
    });
    return res.status(201).json({ blog_category });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error creating blog category';
    return res.status(400).json({ message });
  }
}
