"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBrandImagesSchema = void 0;
exports.POST = POST;
exports.GET = GET;
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/brand/site-scope");
const zod_1 = require("zod");
const create_brand_images_1 = require("../../../../../workflows/create-brand-images");
exports.CreateBrandImagesSchema = zod_1.z.object({
    images: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.enum(['thumbnail', 'image']),
        url: zod_1.z.string(),
        file_id: zod_1.z.string(),
    }))
        .min(1, 'At least one image is required'),
});
async function POST(req, res) {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BRAND_SITE_SCOPE, req.params.brand_id);
    const brand_id = req.params.brand_id;
    const { images } = req.validatedBody;
    const brand_images = images.map((image) => ({
        ...image,
        brand_id,
    }));
    const { result } = await (0, create_brand_images_1.createBrandImagesWorkflow)(req.scope).run({
        input: {
            brand_images,
        },
    });
    res.status(200).json({ brand_images: result });
}
async function GET(req, res) {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BRAND_SITE_SCOPE, req.params.brand_id);
    const brand_id = req.params.brand_id;
    const query = req.scope.resolve('query');
    const { data: brandImages } = await query.graph({
        entity: 'brand_image',
        fields: ['*'],
        filters: {
            brand_id,
        },
    });
    res.status(200).json({ images: brandImages });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9bYnJhbmRfaWRdL2ltYWdlcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFxQkEsb0JBc0JDO0FBRUQsa0JBZ0JDO0FBNURELG1FQUF3RTtBQUN4RSwrREFBcUU7QUFDckUsd0VBQTJFO0FBQzNFLDZCQUF3QjtBQUN4QixzRkFBeUY7QUFFNUUsUUFBQSx1QkFBdUIsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzlDLE1BQU0sRUFBRSxPQUFDO1NBQ04sS0FBSyxDQUNKLE9BQUMsQ0FBQyxNQUFNLENBQUM7UUFDUCxJQUFJLEVBQUUsT0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNwQyxHQUFHLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRTtRQUNmLE9BQU8sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFO0tBQ3BCLENBQUMsQ0FDSDtTQUNBLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZ0NBQWdDLENBQUM7Q0FDNUMsQ0FBQyxDQUFDO0FBSUksS0FBSyxVQUFVLElBQUksQ0FDeEIsR0FBMEMsRUFDMUMsR0FBbUI7SUFFbkIsK0VBQStFO0lBQy9FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsNkJBQWdCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFrQixDQUFDLENBQUM7SUFFN0csTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFrQixDQUFDO0lBQy9DLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsYUFBdUMsQ0FBQztJQUUvRCxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzFDLEdBQUcsS0FBSztRQUNSLFFBQVE7S0FDVCxDQUFDLENBQUMsQ0FBQztJQUVKLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUEsK0NBQXlCLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUNoRSxLQUFLLEVBQUU7WUFDTCxZQUFZO1NBQ2I7S0FDRixDQUFDLENBQUM7SUFFSCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFFTSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsK0VBQStFO0lBQy9FLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUsNkJBQWdCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFrQixDQUFDLENBQUM7SUFFN0csTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFrQixDQUFDO0lBQy9DLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXpDLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQzlDLE1BQU0sRUFBRSxhQUFhO1FBQ3JCLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQztRQUNiLE9BQU8sRUFBRTtZQUNQLFFBQVE7U0FDVDtLQUNGLENBQUMsQ0FBQztJQUVILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDaEQsQ0FBQyJ9