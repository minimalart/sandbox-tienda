import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../../modules/blog';
import type BlogModuleService from '../../../../modules/blog/service';
import { PostAdminUpdateBlogCategory } from '../validators';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { BLOG_CATEGORY_SITE_SCOPE } from '../../../../modules/blog/site-scope';

/** GET /admin/blog-categories/:id */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: borrar la categoría de otra tienda deja sus posts
  // publicados apuntando a nada.
  await assertIdInSite(req.scope, await siteFromRequest(req), BLOG_CATEGORY_SITE_SCOPE, req.params.id as string);

  const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
  try {
    const blog_category = await service.retrieveBlogCategory(
      req.params.id as string,
    );
    return res.status(200).json({ blog_category });
  } catch {
    return res.status(404).json({ message: 'Blog category not found' });
  }
}

/** POST /admin/blog-categories/:id — partial update. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: borrar la categoría de otra tienda deja sus posts
  // publicados apuntando a nada.
  await assertIdInSite(req.scope, await siteFromRequest(req), BLOG_CATEGORY_SITE_SCOPE, req.params.id as string);

  try {
    const validated = PostAdminUpdateBlogCategory.parse(req.body);
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const id = req.params.id as string;
    const { slug, ...rest } = validated;
    const next: Record<string, unknown> = { id, ...rest };
    if (slug !== undefined) {
      next.slug = await service.ensureUniqueCategorySlug(slug, id);
    }
    const blog_category = await service.updateBlogCategories(next);
    return res.status(200).json({ blog_category });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating blog category';
    return res.status(400).json({ message });
  }
}

/** DELETE /admin/blog-categories/:id — soft-delete. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: borrar la categoría de otra tienda deja sus posts
  // publicados apuntando a nada.
  await assertIdInSite(req.scope, await siteFromRequest(req), BLOG_CATEGORY_SITE_SCOPE, req.params.id as string);

  const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
  try {
    const id = req.params.id as string;
    await service.softDeleteBlogCategories(id);
    return res.status(200).json({ id, object: 'blog_category', deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error deleting blog category';
    return res.status(400).json({ message });
  }
}
