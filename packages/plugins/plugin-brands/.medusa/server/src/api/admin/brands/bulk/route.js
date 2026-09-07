"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const utils_1 = require("@medusajs/framework/utils");
const brand_1 = require("../../../../modules/brand");
const POST = async (req, res) => {
    const productModuleService = req.scope.resolve(utils_1.Modules.PRODUCT);
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Invalid request: items array is required' });
        return;
    }
    // Pre-fetch all brands for lookup
    const allBrands = await brandService.listBrands();
    const brandByHandle = new Map(allBrands.map((b) => [b.handle.toLowerCase(), b]));
    // Pre-fetch all products for handle lookup
    const productHandles = [...new Set(items.map((i) => i.product_handle).filter(Boolean))];
    const allProducts = [];
    // Fetch in batches to handle large sets
    for (let i = 0; i < productHandles.length; i += 100) {
        const batch = productHandles.slice(i, i + 100);
        const products = await productModuleService.listProducts({ handle: batch }, { take: batch.length, relations: ['variants'] });
        allProducts.push(...products);
    }
    const productByHandle = new Map(allProducts.map((p) => [p.handle?.toLowerCase(), p]));
    const productBySku = new Map();
    for (const product of allProducts) {
        for (const variant of product.variants || []) {
            if (variant.sku) {
                productBySku.set(variant.sku.toLowerCase(), product);
            }
        }
    }
    // Also fetch products by SKU for rows that use variant_sku but not product_handle
    const skusToFetch = items
        .filter((i) => i.variant_sku && !i.product_handle)
        .map((i) => i.variant_sku);
    if (skusToFetch.length > 0) {
        for (let i = 0; i < skusToFetch.length; i += 100) {
            const batch = skusToFetch.slice(i, i + 100);
            const variants = await productModuleService.listProductVariants({ sku: batch }, { take: batch.length });
            for (const variant of variants) {
                if (variant.product_id && variant.sku) {
                    const product = await productModuleService.retrieveProduct(variant.product_id);
                    productBySku.set(variant.sku.toLowerCase(), product);
                }
            }
        }
    }
    const result = { success: 0, failed: 0, errors: [] };
    for (let idx = 0; idx < items.length; idx++) {
        const row = items[idx];
        const rowNum = idx + 2; // +2 for header row + 0-indexed
        try {
            // Resolve product
            let product = null;
            if (row.product_handle) {
                product = productByHandle.get(row.product_handle.toLowerCase());
            }
            if (!product && row.variant_sku) {
                product = productBySku.get(row.variant_sku.toLowerCase());
            }
            if (!product) {
                result.failed++;
                result.errors.push({
                    row: rowNum,
                    error: `Product not found: handle="${row.product_handle || ''}" sku="${row.variant_sku || ''}"`,
                });
                continue;
            }
            // Resolve brand
            const brand = brandByHandle.get(row.brand_handle?.toLowerCase());
            if (!brand) {
                result.failed++;
                result.errors.push({
                    row: rowNum,
                    error: `Brand not found: handle="${row.brand_handle}"`,
                });
                continue;
            }
            // Check if link already exists
            const existingLinks = await brandService.listProductBrandLinks({
                product_id: product.id,
            });
            if (existingLinks.length > 0) {
                // Remove existing brand links for this product
                await brandService.softDeleteProductBrandLinks(existingLinks.map((l) => l.id));
            }
            // Create new link
            await brandService.createProductBrandLinks({
                product_id: product.id,
                brand_id: brand.id,
            });
            result.success++;
        }
        catch (error) {
            result.failed++;
            result.errors.push({
                row: rowNum,
                error: error.message || 'Unknown error',
            });
        }
    }
    res.json(result);
};
exports.POST = POST;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9idWxrL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHFEQUFvRDtBQUNwRCxxREFBeUQ7QUFtQmxELE1BQU0sSUFBSSxHQUFHLEtBQUssRUFBRSxHQUFrQixFQUFFLEdBQW1CLEVBQUUsRUFBRTtJQUNwRSxNQUFNLG9CQUFvQixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNoRSxNQUFNLFlBQVksR0FBdUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsb0JBQVksQ0FBQyxDQUFDO0lBRXpFLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxHQUFHLENBQUMsSUFBbUIsQ0FBQztJQUUxQyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzFELEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDBDQUEwQyxFQUFFLENBQUMsQ0FBQztRQUM1RSxPQUFPO0lBQ1QsQ0FBQztJQUVELGtDQUFrQztJQUNsQyxNQUFNLFNBQVMsR0FBRyxNQUFNLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNsRCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXRGLDJDQUEyQztJQUMzQyxNQUFNLGNBQWMsR0FBRyxDQUFDLEdBQUcsSUFBSSxHQUFHLENB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