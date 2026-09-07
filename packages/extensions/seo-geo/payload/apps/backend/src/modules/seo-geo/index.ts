import { Module } from '@medusajs/framework/utils';
import SeoGeoModuleService from './service';

export const SEO_GEO_MODULE = 'seo_geo';

export default Module(SEO_GEO_MODULE, {
  service: SeoGeoModuleService,
});
