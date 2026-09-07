import { MedusaService } from '@medusajs/framework/utils';
import { Brand, BrandImage, ProductBrandLink } from './models';

class BrandModuleService extends MedusaService({
  Brand,
  BrandImage,
  ProductBrandLink,
}) {}

export default BrandModuleService;
