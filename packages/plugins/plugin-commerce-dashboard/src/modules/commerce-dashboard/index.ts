import { Module } from '@medusajs/framework/utils';
import CommerceDashboardModuleService from './service';

export const COMMERCE_DASHBOARD_MODULE = 'commerce_dashboard';

export default Module(COMMERCE_DASHBOARD_MODULE, {
  service: CommerceDashboardModuleService,
});
