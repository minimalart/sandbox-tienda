"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/vimeo-video/site-scope");
const vimeo_video_1 = require("../../../../modules/vimeo-video");
const GET = async (req, res) => {
    // Todos los handlers: filtrar el listado y dejar el detalle abierto esconde el
    // video de la otra tienda pero deja borrarlo con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.VIMEO_VIDEO_SITE_SCOPE, req.params.id);
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: 'Video ID is required' });
        return;
    }
    const video = await vimeoVideoModuleService.retrieveVimeoVideo(id, {
        relations: ['product_links'],
    });
    if (!video) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }
    res.json({ video });
};
exports.GET = GET;
const POST = async (req, res) => {
    // Todos los handlers: filtrar el listado y dejar el detalle abierto esconde el
    // video de la otra tienda pero deja borrarlo con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.VIMEO_VIDEO_SITE_SCOPE, req.params.id);
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: 'Video ID is required' });
        return;
    }
    const video = await vimeoVideoModuleService.updateVideo(id, req.validatedBody);
    res.json({ video });
};
exports.POST = POST;
const DELETE = async (req, res) => {
    // Todos los handlers: filtrar el listado y dejar el detalle abierto esconde el
    // video de la otra tienda pero deja borrarlo con sólo saber el id.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.VIMEO_VIDEO_SITE_SCOPE, req.params.id);
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: 'Video ID is required' });
        return;
    }
    await vimeoVideoModuleService.deleteVideo(id);
    res.status(200).json({ id, deleted: true });
};
exports.DELETE = DELETE;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpZGVvcy9baWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdFQUFxRTtBQUNyRSw0REFBa0U7QUFDbEUsMkVBQW9GO0FBQ3BGLGlFQUFxRTtBQUk5RCxNQUFNLEdBQUcsR0FBRyxLQUFLLEVBQUUsR0FBa0IsRUFBRSxHQUFtQixFQUFFLEVBQUU7SUFDbkUsK0VBQStFO0lBQy9FLG1FQUFtRTtJQUNuRSxNQUFNLElBQUEsc0JBQWMsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLG1DQUFzQixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDLENBQUM7SUFFN0csTUFBTSx1QkFBdUIsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBMEIsZ0NBQWtCLENBQUMsQ0FBQztJQUMvRixNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztJQUUxQixJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDUixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUM7UUFDMUQsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLEtBQUssR0FBRyxNQUFNLHVCQUF1QixDQUFDLGtCQUFrQixDQUFDLEVBQUUsRUFBRTtRQUNqRSxTQUFTLEVBQUUsQ0FBQyxlQUFlLENBQUM7S0FDN0IsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ1gsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELE9BQU87SUFDVCxDQUFDO0lBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDO0FBdkJXLFFBQUEsR0FBRyxPQXVCZDtBQUVLLE1BQU0sSUFBSSxHQUFHLEtBQUssRUFBRSxHQUF3QyxFQUFFLEdBQW1CLEVBQUUsRUFBRTtJQUMxRiwrRUFBK0U7SUFDL0UsbUVBQW1FO0lBQ25FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsbUNBQXNCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUU3RyxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBRTFCLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNSLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQztRQUMxRCxPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sS0FBSyxHQUFHLE1BQU0sdUJBQXVCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFL0UsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDO0FBaEJXLFFBQUEsSUFBSSxRQWdCZjtBQUVLLE1BQU0sTUFBTSxHQUFHLEtBQUssRUFBRSxHQUFrQixFQUFFLEdBQW1CLEVBQUUsRUFBRTtJQUN0RSwrRUFBK0U7SUFDL0UsbUVBQW1FO0lBQ25FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsbUNBQXNCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUU3RyxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBRTFCLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNSLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQztRQUMxRCxPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sdUJBQXVCLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRTlDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzlDLENBQUMsQ0FBQztBQWhCVyxRQUFBLE1BQU0sVUFnQmpCIn0=