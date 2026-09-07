import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { BRAND_SITE_SCOPE } from '../../../../../modules/brand/site-scope';
import { BRAND_MODULE } from '../../../../../modules/brand';
import BrandModuleService from '../../../../../modules/brand/service';

type LinkProductsInput = {
  product_ids: string[];
};

type UnlinkProductsInput = {
  product_ids: string[];
};

/**
 * POST /admin/brands/:brand_id/products
 * Link products to a brand
 */
export async function POST(
  req: MedusaRequest<LinkProductsInput>,
  res: MedusaResponse
): Promise<void> {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), BRAND_SITE_SCOPE, req.params.brand_id as string);

  const brand_id = req.params.brand_id as string;
  const input = req.validatedBody as LinkProductsInput;
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

  // Verify brand exists
  const brand = await brandService.retrieveBrand(brand_id);
  if (!brand) {
    res.status(404).json({ message: 'Brand not found' });
    return;
  }

  // Create links for each product
  const links = await Promise.all(
    input.product_ids.map((product_id) =>
      brandService.createProductBrandLinks({
        product_id,
        brand_id,
      })
    )
  );

  res.status(201).json({ links, count: links.length });
}

/**
 * DELETE /admin/brands/:brand_id/products
 * Unlink products from a brand
 */
export async function DELETE(
  req: MedusaRequest<UnlinkProductsInput>,
  res: MedusaResponse
): Promise<void> {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), BRAND_SITE_SCOPE, req.params.brand_id as string);

  const brand_id = req.params.brand_id as string;
  const input = req.validatedBody as UnlinkProductsInput;
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

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
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), BRAND_SITE_SCOPE, req.params.brand_id as string);

  const brand_id = req.params.brand_id as string;
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

  const links = await brandService.listProductBrandLinks({
    brand_id,
  });

  res.status(200).json({ links, count: links.length });
}
