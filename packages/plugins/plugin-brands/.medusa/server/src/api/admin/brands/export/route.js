"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const brand_1 = require("../../../../modules/brand");
const csv_1 = require("../../../../utils/csv");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/brand/site-scope");
const GET = async (req, res) => {
    const productModuleService = req.scope.resolve(utils_1.Modules.PRODUCT);
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    // Get all brands with their handles
    // El export tiene que coincidir con lo que el operador ve en pantalla: un CSV con
    // marcas de otras tiendas se importa después en un sistema externo y ahí ya no hay
    // forma de saber cuáles sobraban.
    const allBrands = await brandService.listBrands(await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BRAND_SITE_SCOPE));
    const brandMap = new Map(allBrands.map((b) => [b.id, b]));
    // Get all links
    const allLinks = await brandService.listProductBrandLinks({}, { take: 10000, select: ['product_id', 'brand_id'] });
    if (allLinks.length === 0) {
        const csv = (0, csv_1.objectsToCSV)([{ product_handle: '', variant_sku: '', brand_handle: '' }], ['product_handle', 'variant_sku', 'brand_handle']);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="brand_associations.csv"');
        res.send(csv);
        return;
    }
    // Get all product IDs from links
    const productIds = [
        ...new Set(allLinks.map((l) => (l.brand_id ? l.product_id : null)).filter(Boolean)),
    ];
    // Fetch products in batches
    const productsMap = new Map();
    for (let i = 0; i < productIds.length; i += 100) {
        const batch = productIds.slice(i, i + 100);
        const products = await productModuleService.listProducts({ id: batch }, { take: batch.length, relations: ['variants'] });
        for (const p of products) {
            productsMap.set(p.id, p);
        }
    }
    // Build CSV rows
    const rows = allLinks
        .map((link) => {
        const product = productsMap.get(link.product_id);
        const brand = brandMap.get(link.brand_id);
        if (!product || !brand)
            return null;
        const firstVariant = product.variants?.[0];
        return {
            product_handle: product.handle || '',
            variant_sku: firstVariant?.sku || '',
            brand_handle: brand.handle || '',
            product_title: product.title || '',
            brand_name: brand.name || '',
        };
    })
        .filter((r) => r !== null);
    const csv = (0, csv_1.objectsToCSV)(rows, [
        'product_handle',
        'variant_sku',
        'brand_handle',
        'product_title',
        'brand_name',
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="brand_associations.csv"');
    res.send(csv);
};
exports.GET = GET;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9leHBvcnQvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EscURBQW9EO0FBQ3BELHFEQUF5RDtBQUV6RCwrQ0FBcUQ7QUFFckQsZ0VBQXFFO0FBQ3JFLDREQUE4RDtBQUM5RCxxRUFBd0U7QUFFakUsTUFBTSxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQWtCLEVBQUUsR0FBbUIsRUFBRSxFQUFFO0lBQ25FLE1BQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZUFBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2hFLE1BQU0sWUFBWSxHQUF1QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFFekUsb0NBQW9DO0lBQ3BDLGtGQUFrRjtJQUNsRixtRkFBbUY7SUFDbkYsa0NBQWtDO0lBQ2xDLE1BQU0sU0FBUyxHQUFHLE1BQU0sWUFBWSxDQUFDLFVBQVUsQ0FDN0MsTUFBTSxJQUFBLGtCQUFVLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSw2QkFBZ0IsQ0FBQyxDQUMxRSxDQUFDO0lBQ0YsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUvRCxnQkFBZ0I7SUFDaEIsTUFBTSxRQUFRLEdBQUcsTUFBTSxZQUFZLENBQUMscUJBQXFCLENBQ3ZELEVBQUUsRUFDRixFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQ3BELENB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