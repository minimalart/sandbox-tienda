import { Module } from '@medusajs/framework/utils';
import VimeoVideoModuleService from './service';

export const VIMEO_VIDEO_MODULE = 'vimeoVideo';

const moduleDefinition: ReturnType<typeof Module> = Module(VIMEO_VIDEO_MODULE, {
  service: VimeoVideoModuleService,
});

export default moduleDefinition;
