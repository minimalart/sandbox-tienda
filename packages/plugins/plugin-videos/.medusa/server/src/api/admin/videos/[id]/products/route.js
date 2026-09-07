"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/vimeo-video/site-scope");
const vimeo_video_1 = require("../../../../../modules/vimeo-video");
const GET = async (req, res) => {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.VIMEO_VIDEO_SITE_SCOPE, req.params.id);
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { id } = req.params;
    const links = await vimeoVideoModuleService.listProductVideoLinks({
        vimeo_video_id: id,
    });
    res.json({ links });
};
exports.GET = GET;
const POST = async (req, res) => {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.VIMEO_VIDEO_SITE_SCOPE, req.params.id);
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { id } = req.params;
    const { product_ids } = req.validatedBody;
    const links = await Promise.all(product_ids.map((product_id) => vimeoVideoModuleService.createProductVideoLinks({
        product_id,
        vimeo_video_id: id,
    })));
    res.status(201).json({ links });
};
exports.POST = POST;
const DELETE = async (req, res) => {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.VIMEO_VIDEO_SITE_SCOPE, req.params.id);
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { id } = req.params;
    const { product_ids } = req.validatedBody;
    const existingLinks = await vimeoVideoModuleService.listProductVideoLinks({
        vimeo_video_id: id,
        product_id: product_ids,
    });
    await Promise.all(existingLinks.map((link) => vimeoVideoModuleService.deleteProductVideoLinks(link.id)));
    res.status(204).send();
};
exports.DELETE = DELETE;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpZGVvcy9baWRdL3Byb2R1Y3RzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLG1FQUF3RTtBQUN4RSwrREFBcUU7QUFDckUsOEVBQXVGO0FBQ3ZGLG9FQUF3RTtBQUlqRSxNQUFNLEdBQUcsR0FBRyxLQUFLLEVBQUUsR0FBa0IsRUFBRSxHQUFtQixFQUFFLEVBQUU7SUFDbkUsK0VBQStFO0lBQy9FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsbUNBQXNCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUU3RyxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBRTFCLE1BQU0sS0FBSyxHQUFHLE1BQU0sdUJBQXVCLENBQUMscUJBQXFCLENBQUM7UUFDaEUsY0FBYyxFQUFFLEVBQUU7S0FDbkIsQ0FBQyxDQUFDO0lBRUgsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDO0FBWlcsUUFBQSxHQUFHLE9BWWQ7QUFFSyxNQUFNLElBQUksR0FBRyxLQUFLLEVBQUUsR0FBeUMsRUFBRSxHQUFtQixFQUFFLEVBQUU7SUFDM0YsK0VBQStFO0lBQy9FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsbUNBQXNCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUU3RyxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBQzFCLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDO0lBRTFDLE1BQU0sS0FBSyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FDN0IsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQWtCLEVBQUUsRUFBRSxDQUNyQyx1QkFBdUIsQ0FBQyx1QkFBdUIsQ0FBQztRQUM5QyxVQUFVO1FBQ1YsY0FBYyxFQUFFLEVBQUU7S0FDbkIsQ0FBQyxDQUNILENBQ0YsQ0FBQztJQUVGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQUM7QUFsQlcsUUFBQSxJQUFJLFFBa0JmO0FBRUssTUFBTSxNQUFNLEdBQUcsS0FBSyxFQUN6QixHQUEyQyxFQUMzQyxHQUFtQixFQUNuQixFQUFFO0lBQ0YsK0VBQStFO0lBQy9FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsbUNBQXNCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUU3RyxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBQzFCLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDO0lBRTFDLE1BQU0sYUFBYSxHQUFHLE1BQU0sdUJBQXVCLENBQUMscUJBQXFCLENBQUM7UUFDeEUsY0FBYyxFQUFFLEVBQUU7UUFDbEIsVUFBVSxFQUFFLFdBQVc7S0FDeEIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUM5Qix1QkFBdUIsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsRUFBWSxDQUFDLENBQ25FLENBQ0YsQ0FBQztJQUVGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDekIsQ0FBQyxDQUFDO0FBdkJXLFFBQUEsTUFBTSxVQXVCakIifQ==