import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { BRAND_MODULE } from '../../../../modules/brand';
import BrandModuleService from '../../../../modules/brand/service';
import { objectsToCSV } from '../../../../utils/csv';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { BRAND_SITE_SCOPE } from '../../../../modules/brand/site-scope';

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

  // Get all brands with their handles
  // El export tiene que coincidir con lo que el operador ve en pantalla: un CSV con
  // marcas de otras tiendas se importa después en un sistema externo y ahí ya no hay
  // forma de saber cuáles sobraban.
  const allBrands = await brandService.listBrands(
    await siteFilter(req.scope, await siteFromRequest(req), BRAND_SITE_SCOPE),
  );
  const brandMap = new Map(allBrands.map((b: any) => [b.id, b]));

  // Get all links
  const allLinks = await brandService.listProductBrandLinks(
    {},
    { take: 10000, select: ['product_id', 'brand_id'] }
  );

  if (allLinks.length === 0) {
    const csv = objectsToCSV(
      [{ product_handle: '', variant_sku: '', brand_handle: '' }],
      ['product_handle', 'variant_sku', 'brand_handle']
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="brand_associations.csv"');
    res.send(csv);
    return;
  }

  // Get all product IDs from links
  const productIds = [
    ...new Set(allLinks.map((l: any) => (l.brand_id ? l.product_id : null)).filter(Boolean)),
  ];

  // Fetch products in batches
  const productsMap = new Map<string, any>();
  for (let i = 0; i < productIds.length; i += 100) {
    const batch = productIds.slice(i, i + 100);
    const products = await productModuleService.listProducts(
      { id: batch as string[] },
      { take: batch.length, relations: ['variants'] }
    );
    for (const p of products) {
      productsMap.set(p.id, p);
    }
  }

  // Build CSV rows
  const rows = allLinks
    .map((link: any) => {
      const product = productsMap.get(link.product_id);
      const brand = brandMap.get(link.brand_id);
      if (!product || !brand) return null;

      const firstVariant = product.variants?.[0];
      return {
        product_handle: product.handle || '',
        variant_sku: firstVariant?.sku || '',
        brand_handle: brand.handle || '',
        product_title: product.title || '',
        brand_name: brand.name || '',
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const csv = objectsToCSV(rows, [
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
