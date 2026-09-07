import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { BRAND_MODULE } from '../../../../../../modules/brand';
import type BrandModuleService from '../../../../../../modules/brand/service';

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { image_id } = req.params;

  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

  await brandService.deleteBrandImages([image_id]);

  res.status(200).json({ success: true, deleted_id: image_id });
}
