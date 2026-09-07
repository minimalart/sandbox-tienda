import { Module } from '@medusajs/framework/utils';
import TypesenseSyncLogService from './service';

export const TYPESENSE_SYNC_LOG_MODULE = 'typesenseSyncLog';

export default Module(TYPESENSE_SYNC_LOG_MODULE, {
  service: TypesenseSyncLogService,
});
