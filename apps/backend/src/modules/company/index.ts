import { Module } from '@medusajs/framework/utils';
import CompanyModuleService from './service';
import { COMPANY_MODULE } from './types';

export { COMPANY_MODULE } from './types';

export default Module(COMPANY_MODULE, {
  service: CompanyModuleService,
});
