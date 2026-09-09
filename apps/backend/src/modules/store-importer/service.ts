import { MedusaService } from '@medusajs/framework/utils';
import { CatalogConnection } from './models/connection';
import { CatalogImport } from './models/job';
import { CatalogRecord } from './models/record';
export default class CatalogImportService extends MedusaService({
  CatalogConnection,
  CatalogImport,
  CatalogRecord,
}) {}
