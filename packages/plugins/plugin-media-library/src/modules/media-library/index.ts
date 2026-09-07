import { Module } from '@medusajs/framework/utils';
import MediaLibraryModuleService from './service';
import { MEDIA_LIBRARY_MODULE } from './types';

export { MEDIA_LIBRARY_MODULE } from './types';

export default Module(MEDIA_LIBRARY_MODULE, {
  service: MediaLibraryModuleService,
});
