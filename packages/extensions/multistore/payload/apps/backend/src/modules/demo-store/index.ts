import { Module } from '@medusajs/framework/utils';
import DemoStoreModuleService from './service';

export const DEMO_STORE_MODULE = 'demo_store';

export default Module(DEMO_STORE_MODULE, {
  service: DemoStoreModuleService,
});
