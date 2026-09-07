import { Module } from '@medusajs/framework/utils';
import AndreaniDataModuleService from './service';

export const ANDREANI_DATA_MODULE = 'andreaniData';

export default Module(ANDREANI_DATA_MODULE, {
  service: AndreaniDataModuleService,
});

export { AndreaniDataModuleService };
