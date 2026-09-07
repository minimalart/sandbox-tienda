import { Module } from '@medusajs/framework/utils';
import CatalogadorModuleService from './service';

export const CATALOGADOR_MODULE = 'catalogador';

export default Module(CATALOGADOR_MODULE, {
  service: CatalogadorModuleService,
});
