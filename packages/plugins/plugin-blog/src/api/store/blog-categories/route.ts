import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../modules/blog';
import type BlogModuleService from '../../../modules/blog/service';
import {
  toPublicBlogCategory,
  isPostInSalesChannel,
  readStrictFlag,
} from '../blog-posts/helpers';

/**
 * GET /store/blog-categories — public list ordered by sort_order then name.
 * With `sales_channel_id` (demo context) devuelve SOLO las categorías que tienen
 * al menos un artículo publicado visible en ese canal (oculta las vacías).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const salesChannelId =
      typeof req.query.sales_channel_id === 'string'
        ? req.query.sales_channel_id
        : undefined;
    const strict = readStrictFlag(req.query);

    const categories = await service.listBlogCategories(
      {},
      { order: { sort_order: 'ASC', name: 'ASC' }, take: 200 },
    );

    let visible = categories as Record<string, any>[];
    if (salesChannelId) {
      // Categorías con posts en el canal: juntamos los category_id de los
      // publicados que pertenecen al canal y filtramos. Los blogs de una demo
      // son pocos, así que traer los publicados y filtrar en JS es barato.
      const [posts] = await service.listAndCountBlogPosts(
        { status: 'published' },
        {},
      );
      const categoryIdsInChannel = new Set(
        (posts as Record<string, any>[])
          .filter((p) => isPostInSalesChannel(p, salesChannelId, strict))
          .map((p) => p.category_id)
          .filter(Boolean),
      );
      visible = visible.filter((c) => categoryIdsInChannel.has(c.id));
    }

    return res.status(200).json({
      blog_categories: visible.map(toPublicBlogCategory),
    });
  } catch (error) {
    console.error('[Store BlogCategories] Error listing categories:', error);
    return res.status(500).json({ message: 'Error fetching blog categories' });
  }
}
