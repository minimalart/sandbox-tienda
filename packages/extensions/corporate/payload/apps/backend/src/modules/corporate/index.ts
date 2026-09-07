import { Module } from '@medusajs/framework/utils';
import CorporateModuleService from './service';
import { CORPORATE_MODULE } from './types';

export { CORPORATE_MODULE } from './types';

export default Module(CORPORATE_MODULE, {
  service: CorporateModuleService,
});
