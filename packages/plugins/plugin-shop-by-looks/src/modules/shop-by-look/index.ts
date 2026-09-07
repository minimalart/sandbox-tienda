import { Module } from '@medusajs/framework/utils';
import ShopByLookModuleService from './service';

export const SHOP_BY_LOOK_MODULE = 'shop_by_look';

export default Module(SHOP_BY_LOOK_MODULE, {
  service: ShopByLookModuleService,
});
