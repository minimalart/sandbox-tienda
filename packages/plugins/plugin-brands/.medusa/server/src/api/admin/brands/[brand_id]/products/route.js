"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.DELETE = DELETE;
exports.GET = GET;
const request_1 = require("../../../../../lib/multistore/request");
const scope_1 = require("../../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../../modules/brand/site-scope");
const brand_1 = require("../../../../../modules/brand");
/**
 * POST /admin/brands/:brand_id/products
 * Link products to a brand
 */
async function POST(req, res) {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BRAND_SITE_SCOPE, req.params.brand_id);
    const brand_id = req.params.brand_id;
    const input = req.validatedBody;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    // Verify brand exists
    const brand = await brandService.retrieveBrand(brand_id);
    if (!brand) {
        res.status(404).json({ message: 'Brand not found' });
        return;
    }
    // Create links for each product
    const links = await Promise.all(input.product_ids.map((product_id) => brandService.createProductBrandLinks({
        product_id,
        brand_id,
    })));
    res.status(201).json({ links, count: links.length });
}
/**
 * DELETE /admin/brands/:brand_id/products
 * Unlink products from a brand
 */
async function DELETE(req, res) {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BRAND_SITE_SCOPE, req.params.brand_id);
    const brand_id = req.params.brand_id;
    const input = req.validatedBody;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    // Find and soft-delete all links for these products
    const links = await brandService.listProductBrandLinks({
        brand_id,
        product_id: input.product_ids,
    });
    if (links.length === 0) {
        res.status(404).json({ message: 'No product links found' });
        return;
    }
    await brandService.softDeleteProductBrandLinks(links.map((link) => link.id));
    res.status(200).json({ message: 'Products unlinked', count: links.length });
}
/**
 * GET /admin/brands/:brand_id/products
 * Get all products linked to a brand
 */
async function GET(req, res) {
    // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.BRAND_SITE_SCOPE, req.params.brand_id);
    const brand_id = req.params.brand_id;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const links = await brandService.listProductBrandLinks({
        brand_id,
    });
    res.status(200).json({ links, count: links.length });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9bYnJhbmRfaWRdL3Byb2R1Y3RzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBbUJBLG9CQTZCQztBQU1ELHdCQXlCQztBQU1ELGtCQVlDO0FBaEdELG1FQUF3RTtBQUN4RSwrREFBcUU7QUFDckUsd0VBQTJFO0FBQzNFLHdEQUE0RDtBQVc1RDs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUN4QixHQUFxQyxFQUNyQyxHQUFtQjtJQUVuQiwrRUFBK0U7SUFDL0UsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSw2QkFBZ0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQWtCLENBQUMsQ0FBQztJQUU3RyxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQWtCLENBQUM7SUFDL0MsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLGFBQWtDLENBQUM7SUFDckQsTUFBTSxZQUFZLEdBQXVCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLG9CQUFZLENBQUMsQ0FBQztJQUV6RSxzQkFBc0I7SUFDdEIsTUFBTSxLQUFLLEdBQUcsTUFBTSxZQUFZLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3pELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNYLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUNyRCxPQUFPO0lBQ1QsQ0FBQztJQUVELGdDQUFnQztJQUNoQyxNQUFNLEtBQUssR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQzdCLEtBQUssQ0FBQyxXQUFXLENB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