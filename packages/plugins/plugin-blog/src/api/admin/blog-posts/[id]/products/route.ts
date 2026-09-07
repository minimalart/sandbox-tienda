import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { BLOG_POST_SITE_SCOPE } from '../../../../../modules/blog/site-scope';
import { BLOG_MODULE } from '../../../../../modules/blog';
import type BlogModuleService from '../../../../../modules/blog/service';
import { PostAdminSetBlogPostProducts } from '../../validators';

/** GET /admin/blog-posts/:id/products — ordered product ids for the post. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), BLOG_POST_SITE_SCOPE, req.params.id as string);

  const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
  const product_ids = await service.getPostProductIds(req.params.id as string);
  return res.status(200).json({ product_ids });
}

/**
 * POST /admin/blog-posts/:id/products — replace the post's associations with
 * the given ordered `product_ids` (index becomes sort_order).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), BLOG_POST_SITE_SCOPE, req.params.id as string);

  try {
    const { product_ids } = PostAdminSetBlogPostProducts.parse(req.body);
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    await service.setPostProducts(req.params.id as string, product_ids);
    return res.status(200).json({ product_ids });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error setting products';
    return res.status(400).json({ message });
  }
}
