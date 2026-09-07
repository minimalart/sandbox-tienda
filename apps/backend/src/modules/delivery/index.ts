import { Module } from '@medusajs/framework/utils';
import DeliveryModuleService from './service';
import { DELIVERY_MODULE } from './types';

export { DELIVERY_MODULE } from './types';

export default Module(DELIVERY_MODULE, {
  service: DeliveryModuleService,
});
