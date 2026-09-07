"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBrandSchema = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const zod_1 = require("zod");
const brand_1 = require("../../../../modules/brand");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/brand/site-scope");
exports.UpdateBrandSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    handle: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    is_active: zod_1.z.boolean().optional(),
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).nullish(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Las tres rutas de detalle pasan por `assertRowInSite`.
 *
 * Filtrar sólo el listado esconde la marca de otra tienda pero deja editarla y
 * borrarla si conocés el id — que es una escritura cruzada real, no cosmética. Por
 * eso una ruta cuenta como migrada sólo si sus mutaciones también validan.
 */
async function GET(req, res) {
    const brand_id = req.params.brand_id;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const site = await (0, request_1.siteFromRequest)(req);
    const brand = await brandService.retrieveBrand(brand_id);
    (0, scope_1.assertRowInSite)(brand, site, site_scope_1.BRAND_SITE_SCOPE);
    res.status(200).json({ brand });
}
async function POST(req, res) {
    const brand_id = req.params.brand_id;
    const input = req.validatedBody;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const site = await (0, request_1.siteFromRequest)(req);
    (0, scope_1.assertRowInSite)((await brandService.retrieveBrand(brand_id)), site, site_scope_1.BRAND_SITE_SCOPE);
    const brand = await brandService.updateBrands({
        id: brand_id,
        ...input,
        // sales_channel_ids: array en columna model.json() (tipada como Record).
        sales_channel_ids: input.sales_channel_ids,
    });
    res.status(200).json({ brand });
}
async function DELETE(req, res) {
    const brand_id = req.params.brand_id;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const site = await (0, request_1.siteFromRequest)(req);
    (0, scope_1.assertRowInSite)((await brandService.retrieveBrand(brand_id)), site, site_scope_1.BRAND_SITE_SCOPE);
    await brandService.deleteBrands(brand_id);
    res.status(200).json({ id: brand_id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9bYnJhbmRfaWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQTBCQSxrQkFTQztBQUVELG9CQXVCQztBQUVELHdCQWNDO0FBM0VELDZCQUF3QjtBQUN4QixxREFBeUQ7QUFFekQsZ0VBQXFFO0FBQ3JFLDREQUFtRTtBQUNuRSxxRUFBd0U7QUFFM0QsUUFBQSxpQkFBaUIsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ3hDLElBQUksRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRTtJQUNsQyxNQUFNLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsV0FBVyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsU0FBUyxFQUFFLE9BQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsaUJBQWlCLEVBQUUsT0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUU7SUFDaEQsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRTtDQUN2RCxDQUFDLENBQUM7QUFJSDs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFrQixDQUFDO0lBQy9DLE1BQU0sWUFBWSxHQUF1QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFDekUsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFFeEMsTUFBTSxLQUFLLEdBQUcsTUFBTSxZQUFZLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3pELElBQUEsdUJBQWUsRUFBQyxLQUFnQyxFQUFFLElBQUksRUFBRSw2QkFBZ0IsQ0FBQyxDQUFDO0lBRTFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRU0sS0FBSyxVQUFVLElBQUksQ0FDeEIsR0FBb0MsRUFDcEMsR0FBbUI7SUFFbkIsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFrQixDQUFDO0lBQy9DLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxhQUFpQyxDQUFDO0lBQ3BELE1BQU0sWUFBWSxHQUF1QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFDekUsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFFeEMsSUFBQSx1QkFBZSxFQUNiLENBQUMsTUFBTSxZQUFZLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUE0QixFQUN2RSxJQUFJLEVBQ0osNkJBQWdCLENBQ2pCLENBQUM7SUFFRixNQUFNLEtBQUssR0FBRyxNQUFNLFlBQVksQ0FBQyxZQUFZLENBQUM7UUFDNUMsRUFBRSxFQUFFLFFBQVE7UUFDWixHQUFHLEtBQUs7UUFDUix5RUFBeUU7UUFDekUsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGlCQUF3QjtLQUNsRCxDQUFDLENBQUM7SUFFSCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDbEMsQ0FBQztBQUVNLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNsRSxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQWtCLENBQUM7SUFDL0MsTUFBTSxZQUFZLEdBQXVCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLG9CQUFZLENBQUMsQ0FBQztJQUN6RSxNQUFNLElBQUksR0FBRyxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQztJQUV4QyxJQUFBLHVCQUFlLEVBQ2IsQ0FBQyxNQUFNLFlBQVksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQTRCLEVBQ3ZFLElBQUksRUFDSiw2QkFBZ0IsQ0FDakIsQ0FBQztJQUVGLE1BQU0sWUFBWSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUUxQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDeEQsQ0FBQyJ9