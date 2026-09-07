import { Module } from '@medusajs/framework/utils';
import StoreLocationModuleService from './service';

export const STORE_LOCATION_MODULE = 'storeLocation';

export default Module(STORE_LOCATION_MODULE, {
  service: StoreLocationModuleService,
});
