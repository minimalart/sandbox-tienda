import { MedusaService } from '@medusajs/framework/utils';
import { ShopByLook, ShopByLookProduct } from './models';

class ShopByLookModuleService extends MedusaService({
  ShopByLook,
  ShopByLookProduct,
}) {}

export default ShopByLookModuleService;
