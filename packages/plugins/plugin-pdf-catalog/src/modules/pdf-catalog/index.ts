import { Module } from '@medusajs/framework/utils';
import PdfCatalogModuleService from './service';

export const PDF_CATALOG_MODULE = 'pdf_catalog';

export default Module(PDF_CATALOG_MODULE, {
  service: PdfCatalogModuleService,
});
