import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { VIMEO_VIDEO_MODULE } from '../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../modules/vimeo-video/service';

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

  const { product_id } = req.query;
  const salesChannelId =
    typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
  const strict = req.query.strict === '1' || req.query.strict === 'true';

  // Visibilidad por canal (misma regla que el blog): `sales_channel_ids` vacío =
  // global (visible en todos, incl. store principal); no vacío = solo en esos
  // canales; `strict` (contexto demo) además oculta los globales para que una
  // demo muestre solo lo suyo.
  const inScope = (video: Record<string, unknown>): boolean => {
    if (!salesChannelId) return true;
    const ids = video.sales_channel_ids;
    const scoped = Array.isArray(ids) && (ids as string[]).length > 0;
    if (scoped) return (ids as string[]).includes(salesChannelId);
    return !strict;
  };

  if (product_id) {
    try {
      const links = await vimeoVideoModuleService.listProductVideoLinks({
        product_id: product_id as string,
      });

      const videoIds = links.map((link: Record<string, unknown>) => link.vimeo_video_id);

      if (videoIds.length === 0) {
        res.json({ videos: [] });
        return;
      }

      const videos = await vimeoVideoModuleService.listVimeoVideoes({
        id: videoIds,
        is_active: true,
      });

      res.json({ videos: videos.filter(inScope) });
    } catch {
      res.json({ videos: [] });
    }
    return;
  }

  // Return all active videos ordered by sort_order, then created_at
  const allVideos = (
    await vimeoVideoModuleService.listVideos(
      { is_active: true },
      {
        order: { sort_order: 'ASC', created_at: 'DESC' },
      }
    )
  ).filter(inScope);

  if (allVideos.length === 0) {
    res.json({ videos: [] });
    return;
  }

  // Attempt to hydrate with product links
  try {
    const videos = (
      await vimeoVideoModuleService.listVideos(
        { is_active: true },
        {
          relations: ['product_links'],
          order: { sort_order: 'ASC', created_at: 'DESC' },
        }
      )
    ).filter(inScope);

    const query = req.scope.resolve('query');

    const videosWithProducts = await Promise.all(
      videos.map(async (video: Record<string, unknown>) => {
        const productLinks =
          (video.product_links as any)?.isInitialized?.() === false
            ?
              await (video.product_links as any).loadItems()
            :
              (video.product_links as any)?.getItems?.() || video.product_links || [];

        if (!productLinks || productLinks.length === 0) {
          return { ...video, products: [] };
        }

        const productIds = productLinks.map(
          (link: Record<string, unknown>) => link.product_id
        );

        try {
          const { data: products } = await query.graph({
            entity: 'product',
            fields: ['id', 'title', 'handle', 'description', 'thumbnail', 'variants.id'],
            filters: { id: productIds },
          });

          return { ...video, products: products || [] };
        } catch {
          return { ...video, products: [] };
        }
      })
    );

    res.json({ videos: videosWithProducts });
  } catch {
    // Fallback: return videos without relation hydration
    res.json({ videos: allVideos });
  }
};
