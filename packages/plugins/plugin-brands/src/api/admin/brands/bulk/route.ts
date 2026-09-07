import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { BRAND_MODULE } from '../../../../modules/brand';
import BrandModuleService from '../../../../modules/brand/service';

interface BulkBrandRow {
  product_handle: string;
  variant_sku?: string;
  brand_handle: string;
}

interface BulkRequest {
  items: BulkBrandRow[];
}

interface ProcessResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

  const { items } = req.body as BulkRequest;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Invalid request: items array is required' });
    return;
  }

  // Pre-fetch all brands for lookup
  const allBrands = await brandService.listBrands();
  const brandByHandle = new Map(allBrands.map((b: any) => [b.handle.toLowerCase(), b]));

  // Pre-fetch all products for handle lookup
  const productHandles = [...new Set(items.map((i) => i.product_handle).filter(Boolean))];
  const allProducts: any[] = [];

  // Fetch in batches to handle large sets
  for (let i = 0; i < productHandles.length; i += 100) {
    const batch = productHandles.slice(i, i + 100);
    const products = await productModuleService.listProducts(
      { handle: batch },
      { take: batch.length, relations: ['variants'] }
    );
    allProducts.push(...products);
  }

  const productByHandle = new Map(allProducts.map((p: any) => [p.handle?.toLowerCase(), p]));
  const productBySku = new Map<string, any>();
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
    .map((i) => i.variant_sku!);

  if (skusToFetch.length > 0) {
    for (let i = 0; i < skusToFetch.length; i += 100) {
      const batch = skusToFetch.slice(i, i + 100);
      const variants = await productModuleService.listProductVariants(
        { sku: batch },
        { take: batch.length }
      );
      for (const variant of variants) {
        if (variant.product_id && variant.sku) {
          const product = await productModuleService.retrieveProduct(variant.product_id);
          productBySku.set(variant.sku.toLowerCase(), product);
        }
      }
    }
  }

  const result: ProcessResult = { success: 0, failed: 0, errors: [] };

  for (let idx = 0; idx < items.length; idx++) {
    const row = items[idx]!;
    const rowNum = idx + 2; // +2 for header row + 0-indexed

    try {
      // Resolve product
      let product: any = null;
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
        await brandService.softDeleteProductBrandLinks(existingLinks.map((l: any) => l.id));
      }

      // Create new link
      await brandService.createProductBrandLinks({
        product_id: product.id,
        brand_id: brand.id,
      });

      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push({
        row: rowNum,
        error: error.message || 'Unknown error',
      });
    }
  }

  res.json(result);
};
