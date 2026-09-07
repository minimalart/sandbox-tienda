import { Module } from '@medusajs/framework/utils';
import BillingProfileModuleService from './service';
import { BILLING_PROFILE_MODULE } from './types';

export { BILLING_PROFILE_MODULE } from './types';

export default Module(BILLING_PROFILE_MODULE, {
  service: BillingProfileModuleService,
});
