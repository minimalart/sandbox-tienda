import { Module } from '@medusajs/framework/utils';
import DynamicGroupsModuleService from './service';
import { DYNAMIC_GROUPS_MODULE } from './types';

export { DYNAMIC_GROUPS_MODULE } from './types';

export default Module(DYNAMIC_GROUPS_MODULE, {
  service: DynamicGroupsModuleService,
});
