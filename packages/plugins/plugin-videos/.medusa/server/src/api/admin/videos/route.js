"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/vimeo-video/site-scope");
const utils_1 = require("@medusajs/framework/utils");
const vimeo_video_1 = require("../../../modules/vimeo-video");
// Estados no-terminales: el video sigue procesándose en Vimeo. Los videos se
// crean con este estado (transcoding/uploading) y Vimeo termina en background,
// así que al listar re-sincronizamos los que siguen "en progreso".
const IN_PROGRESS_STATUSES = ['uploading', 'transcoding', 'processing', 'transcode_starting'];
const GET = async (req, res) => {
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { offset = 0, limit = 50, order = '-created_at' } = req.query;
    const listOptions = {
        skip: Number(offset),
        take: Number(limit),
        order: { created_at: order === '-created_at' ? 'DESC' : 'ASC' },
    };
    const resolution = await (0, request_1.siteFromRequest)(req);
    const siteWhere = await (0, scope_1.siteFilter)(req.scope, resolution, site_scope_1.VIMEO_VIDEO_SITE_SCOPE);
    let videos = await vimeoVideoModuleService.listVideos(siteWhere, listOptions);
    // Auto-heal del estado: re-sincroniza desde Vimeo los videos en progreso
    // (best-effort, no rompe el listado si Vimeo falla o no está conectado) y
    // vuelve a listar para devolver los estados frescos.
    const stale = videos.filter((v) => IN_PROGRESS_STATUSES.includes(v.status));
    if (stale.length > 0) {
        await Promise.all(stale.map((v) => vimeoVideoModuleService.syncVideoFromVimeo(v.id).catch(() => null)));
        videos = await vimeoVideoModuleService.listVideos(siteWhere, listOptions);
    }
    res.json({
        videos,
        count: videos.length,
        offset: Number(offset),
        limit: Number(limit),
    });
};
exports.GET = GET;
const POST = async (req, res) => {
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    // El video nace con los canales de la tienda activa. Sin esto se crea global y
    // aparece en todas — y el creador no vuelve a encontrarlo donde lo subió.
    const video = await vimeoVideoModuleService.createVideo({
        ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.VIMEO_VIDEO_SITE_SCOPE),
        ...req.validatedBody,
    });
    try {
        await query.graph({
            entity: 'vimeo_video',
            fields: ['*'],
            filters: { id: video.id },
        });
    }
    catch (error) {
        console.error('[API] Failed to commit:', error);
    }
    res.status(201).json({ video });
};
exports.POST = POST;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpZGVvcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw2REFBa0U7QUFDbEUseURBQXlFO0FBQ3pFLHdFQUFpRjtBQUNqRixxREFBc0U7QUFDdEUsOERBQWtFO0FBSWxFLDZFQUE2RTtBQUM3RSwrRUFBK0U7QUFDL0UsbUVBQW1FO0FBQ25FLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxXQUFXLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0FBRXZGLE1BQU0sR0FBRyxHQUFHLEtBQUssRUFBRSxHQUFrQixFQUFFLEdBQW1CLEVBQUUsRUFBRTtJQUNuRSxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBRS9GLE1BQU0sRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxFQUFFLEVBQUUsS0FBSyxHQUFHLGFBQWEsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUM7SUFDcEUsTUFBTSxXQUFXLEdBQUc7UUFDbEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDcEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFDbkIsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLEtBQUssS0FBSyxhQUFhLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUUsS0FBZSxFQUFFO0tBQzNFLENBQUM7SUFFRixNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQztJQUM5QyxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUEsa0JBQVUsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxtQ0FBc0IsQ0FBQyxDQUFDO0lBRWxGLElBQUksTUFBTSxHQUFHLE1BQU0sdUJBQXVCLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUU5RSx5RUFBeUU7SUFDekUsMEVBQTBFO0lBQzFFLHFEQUFxRDtJQUNyRCxNQUFNLEtBQUssR0FBSSxNQUFxQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQ2hFLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQ3hDLENBQUM7SUFDRixJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDckIsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDL0YsQ0FBQztRQUNGLE1BQU0sR0FBRyxNQUFNLHVCQUF1QixDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDUCxNQUFNO1FBQ04sS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3BCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ3RCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDO0tBQ3JCLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQztBQWxDVyxRQUFBLEdBQUcsT0FrQ2Q7QUFFSyxNQUFNLElBQUksR0FBRyxLQUFLLEVBQUUsR0FBd0MsRUFBRSxHQUFtQixFQUFFLEVBQUU7SUFDMUYsTUFBTSx1QkFBdUIsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBMEIsZ0NBQWtCLENBQUMsQ0FBQztJQUUvRixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVqRSwrRUFBK0U7SUFDL0UsMEVBQTBFO0lBQzFFLE1BQU0sS0FBSyxHQUFHLE1BQU0sdUJBQXVCLENBQUMsV0FBVyxDQUFDO1FBQ3RELEdBQUcsSUFBQSxvQkFBWSxFQUFDLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLG1DQUFzQixDQUFDO1FBQ25FLEdBQUcsR0FBRyxDQUFDLGFBQWE7S0FDTyxDQUFDLENBQUM7SUFFL0IsSUFBSSxDQUFDO1FBQ0gsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1lBQ2hCLE1BQU0sRUFBRSxhQUFhO1lBQ3JCLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNiLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFO1NBQzFCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ2xDLENBQUMsQ0FBQztBQXZCVyxRQUFBLElBQUksUUF1QmYifQ==