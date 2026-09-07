import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { BRAND_MODULE } from '../../../../modules/brand';
import BrandModuleService from '../../../../modules/brand/service';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const brand_id = req.params.brand_id as string;
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

  const brand = await brandService.retrieveBrand(brand_id);

  if (!brand.is_active) {
    res.status(404).json({ message: 'Brand not found' });
    return;
  }

  res.status(200).json({ brand });
}
