import { Module } from '@medusajs/framework/utils';
import AbandonedCartModuleService from './service';
import { ABANDONED_CART_MODULE } from './types';

export { ABANDONED_CART_MODULE } from './types';

export default Module(ABANDONED_CART_MODULE, {
  service: AbandonedCartModuleService,
});
