import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { BRAND_MODULE } from '../../../../modules/brand';
import BrandModuleService from '../../../../modules/brand/service';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../lib/multistore/scope';
import { BRAND_SITE_SCOPE } from '../../../../modules/brand/site-scope';

export const UpdateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  sales_channel_ids: z.array(z.string()).nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;

/**
 * Las tres rutas de detalle pasan por `assertRowInSite`.
 *
 * Filtrar sólo el listado esconde la marca de otra tienda pero deja editarla y
 * borrarla si conocés el id — que es una escritura cruzada real, no cosmética. Por
 * eso una ruta cuenta como migrada sólo si sus mutaciones también validan.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const brand_id = req.params.brand_id as string;
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);
  const site = await siteFromRequest(req);

  const brand = await brandService.retrieveBrand(brand_id);
  assertRowInSite(brand as Record<string, unknown>, site, BRAND_SITE_SCOPE);

  res.status(200).json({ brand });
}

export async function POST(
  req: MedusaRequest<UpdateBrandInput>,
  res: MedusaResponse
): Promise<void> {
  const brand_id = req.params.brand_id as string;
  const input = req.validatedBody as UpdateBrandInput;
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);
  const site = await siteFromRequest(req);

  assertRowInSite(
    (await brandService.retrieveBrand(brand_id)) as Record<string, unknown>,
    site,
    BRAND_SITE_SCOPE,
  );

  const brand = await brandService.updateBrands({
    id: brand_id,
    ...input,
    // sales_channel_ids: array en columna model.json() (tipada como Record).
    sales_channel_ids: input.sales_channel_ids as any,
  });

  res.status(200).json({ brand });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const brand_id = req.params.brand_id as string;
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);
  const site = await siteFromRequest(req);

  assertRowInSite(
    (await brandService.retrieveBrand(brand_id)) as Record<string, unknown>,
    site,
    BRAND_SITE_SCOPE,
  );

  await brandService.deleteBrands(brand_id);

  res.status(200).json({ id: brand_id, deleted: true });
}
