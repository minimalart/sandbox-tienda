import { Module } from '@medusajs/framework/utils';
import DatabaseExplorerModuleService from './service';

export const DATABASE_EXPLORER_MODULE = 'database_explorer';

export default Module(DATABASE_EXPLORER_MODULE, {
  service: DatabaseExplorerModuleService,
});
