import './dashboard-dataset';
import { Module } from '@medusajs/framework/utils';
import RecurringOrderModuleService from './service';
import { RECURRING_ORDER_MODULE } from './types';

export { RECURRING_ORDER_MODULE } from './types';

export default Module(RECURRING_ORDER_MODULE, {
  service: RecurringOrderModuleService,
});
