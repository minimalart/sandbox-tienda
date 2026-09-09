import { Module } from '@medusajs/framework/utils';
import CatalogImportService from './service';
export const CATALOG_IMPORT_MODULE = 'catalog_import';
export default Module(CATALOG_IMPORT_MODULE, { service: CatalogImportService });
