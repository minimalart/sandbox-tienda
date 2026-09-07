"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const vimeo_video_1 = require("../../../modules/vimeo-video");
const GET = async (req, res) => {
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { product_id } = req.query;
    const salesChannelId = typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
    const strict = req.query.strict === '1' || req.query.strict === 'true';
    // Visibilidad por canal (misma regla que el blog): `sales_channel_ids` vacío =
    // global (visible en todos, incl. store principal); no vacío = solo en esos
    // canales; `strict` (contexto demo) además oculta los globales para que una
    // demo muestre solo lo suyo.
    const inScope = (video) => {
        if (!salesChannelId)
            return true;
        const ids = video.sales_channel_ids;
        const scoped = Array.isArray(ids) && ids.length > 0;
        if (scoped)
            return ids.includes(salesChannelId);
        return !strict;
    };
    if (product_id) {
        try {
            const links = await vimeoVideoModuleService.listProductVideoLinks({
                product_id: product_id,
            });
            const videoIds = links.map((link) => link.vimeo_video_id);
            if (videoIds.length === 0) {
                res.json({ videos: [] });
                return;
            }
            const videos = await vimeoVideoModuleService.listVimeoVideoes({
                id: videoIds,
                is_active: true,
            });
            res.json({ videos: videos.filter(inScope) });
        }
        catch {
            res.json({ videos: [] });
        }
        return;
    }
    // Return all active videos ordered by sort_order, then created_at
    const allVideos = (await vimeoVideoModuleService.listVideos({ is_active: true }, {
        order: { sort_order: 'ASC', created_at: 'DESC' },
    })).filter(inScope);
    if (allVideos.length === 0) {
        res.json({ videos: [] });
        return;
    }
    // Attempt to hydrate with product links
    try {
        const videos = (await vimeoVideoModuleService.listVideos({ is_active: true }, {
            relations: ['product_links'],
            order: { sort_order: 'ASC', created_at: 'DESC' },
        })).filter(inScope);
        const query = req.scope.resolve('query');
        const videosWithProducts = await Promise.all(videos.map(async (video) => {
            const productLinks = video.product_links?.isInitialized?.() === false
                ?
                    await video.product_links.loadItems()
                :
                    video.product_links?.getItems?.() || video.product_links || [];
            if (!productLinks || productLinks.length === 0) {
                return { ...video, products: [] };
            }
            const productIds = productLinks.map((link) => link.product_id);
            try {
                const { data: products } = await query.graph({
                    entity: 'product',
                    fields: ['id', 'title', 'handle', 'description', 'thumbnail', 'variants.id'],
                    filters: { id: productIds },
                });
                return { ...video, products: products || [] };
            }
            catch {
                return { ...video, products: [] };
            }
        }));
        res.json({ videos: videosWithProducts });
    }
    catch {
        // Fallback: return videos without relation hydration
        res.json({ videos: allVideos });
    }
};
exports.GET = GET;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3ZpZGVvcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4REFBa0U7QUFHM0QsTUFBTSxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQWtCLEVBQUUsR0FBbUIsRUFBRSxFQUFFO0lBQ25FLE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQTBCLGdDQUFrQixDQUFDLENBQUM7SUFFL0YsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUM7SUFDakMsTUFBTSxjQUFjLEdBQ2xCLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUMxRixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDO0lBRXZFLCtFQUErRTtJQUMvRSw0RUFBNEU7SUFDNUUsNEVBQTRFO0lBQzVFLDZCQUE2QjtJQUM3QixNQUFNLE9BQU8sR0FBRyxDQUFDLEtBQThCLEVBQVcsRUFBRTtRQUMxRCxJQUFJLENBQUMsY0FBYztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ2pDLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztRQUNwQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFLLEdBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNsRSxJQUFJLE1BQU07WUFBRSxPQUFRLEdBQWdCLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzlELE9BQU8sQ0FB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