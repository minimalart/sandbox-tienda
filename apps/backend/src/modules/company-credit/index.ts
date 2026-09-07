import { Module } from '@medusajs/framework/utils';
import CompanyCreditModuleService from './service';

export { COMPANY_CREDIT_MODULE } from './types';

export default Module('company_credit', {
  service: CompanyCreditModuleService,
});
