"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateShopByLookSchema = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const zod_1 = require("zod");
const shop_by_look_1 = require("../../../../modules/shop-by-look");
const route_1 = require("../route");
const multistore_1 = require("../../../../lib/multistore");
const site_scope_1 = require("../../../../modules/shop-by-look/site-scope");
exports.UpdateShopByLookSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    subtitle: zod_1.z.string().nullable().optional(),
    cta_label: zod_1.z.string().nullable().optional(),
    image_url: zod_1.z.string().min(1).optional(),
    image_alt: zod_1.z.string().nullable().optional(),
    is_active: zod_1.z.boolean().optional(),
    sort_order: zod_1.z.number().int().optional(),
    placement: zod_1.z.enum(route_1.PLACEMENTS).optional(),
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    region_ids: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    // Cuando se envía `products`, REEMPLAZA toda la lista de hotspots del look.
    products: zod_1.z.array(route_1.ShopByLookProductSchema).optional(),
});
async function GET(req, res) {
    const look_id = req.params.look_id;
    const service = req.scope.resolve(shop_by_look_1.SHOP_BY_LOOK_MODULE);
    const shop_by_look = await service.retrieveShopByLook(look_id, {
        relations: ['products'],
    });
    (0, multistore_1.assertRowInSite)(shop_by_look, await (0, multistore_1.siteFromRequest)(req), site_scope_1.SHOP_BY_LOOK_SITE_SCOPE);
    res.status(200).json({ shop_by_look });
}
async function POST(req, res) {
    const look_id = req.params.look_id;
    const input = req.validatedBody;
    const service = req.scope.resolve(shop_by_look_1.SHOP_BY_LOOK_MODULE);
    const { products, ...lookData } = input;
    // model.json() tipa los arrays (sales_channel_ids/region_ids) como
    // Record<string, unknown>; el cast evita el falso conflicto de tipos.
    (0, multistore_1.assertRowInSite)((await service.retrieveShopByLook(look_id)), await (0, multistore_1.siteFromRequest)(req), site_scope_1.SHOP_BY_LOOK_SITE_SCOPE);
    await service.updateShopByLooks({ id: look_id, ...lookData });
    // Reemplazo completo de los hotspots cuando el cliente manda `products`.
    if (products !== undefined) {
        const existing = await service.listShopByLookProducts({ look_id });
        if (existing.length) {
            await service.deleteShopByLookProducts(existing.map((e) => e.id));
        }
        if (products.length) {
            await service.createShopByLookProducts(products.map((p) => ({
                product_id: p.product_id,
                variant_id: p.variant_id ?? null,
                pos_x: p.pos_x ?? 50,
                pos_y: p.pos_y ?? 50,
                sort_order: p.sort_order ?? 0,
                look_id,
            })));
        }
    }
    const shop_by_look = await service.retrieveShopByLook(look_id, {
        relations: ['products'],
    });
    res.status(200).json({ shop_by_look });
}
async function DELETE(req, res) {
    const look_id = req.params.look_id;
    const service = req.scope.resolve(shop_by_look_1.SHOP_BY_LOOK_MODULE);
    (0, multistore_1.assertRowInSite)((await service.retrieveShopByLook(look_id)), await (0, multistore_1.siteFromRequest)(req), site_scope_1.SHOP_BY_LOOK_SITE_SCOPE);
    await service.deleteShopByLooks(look_id);
    res.status(200).json({ id: look_id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3Nob3AtYnktbG9va3MvW2xvb2tfaWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQTBCQSxrQkFVQztBQUVELG9CQTZDQztBQUVELHdCQWFDO0FBakdELDZCQUF3QjtBQUN4QixtRUFBdUU7QUFFdkUsb0NBQStEO0FBQy9ELDJEQUE4RTtBQUM5RSw0RUFBc0Y7QUFFekUsUUFBQSxzQkFBc0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzdDLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRTtJQUNuQyxRQUFRLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQyxTQUFTLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMzQyxTQUFTLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDdkMsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDM0MsU0FBUyxFQUFFLE9BQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsVUFBVSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdkMsU0FBUyxFQUFFLE9BQUMsQ0FBQyxJQUFJLENBQUMsa0JBQVUsQ0FBQyxDQUFDLFFBQVEsRUFBRTtJQUN4QyxpQkFBaUIsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLFFBQVEs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