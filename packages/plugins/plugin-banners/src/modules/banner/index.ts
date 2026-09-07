import { Module } from '@medusajs/framework/utils';
import BannerModuleService from './service';

export const BANNER_MODULE = 'banner';

const moduleDefinition: ReturnType<typeof Module> = Module(BANNER_MODULE, {
  service: BannerModuleService,
});

export default moduleDefinition;
