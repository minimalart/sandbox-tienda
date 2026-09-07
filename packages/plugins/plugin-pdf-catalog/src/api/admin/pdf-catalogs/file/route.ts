import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { PDF_CATALOG_SITE_SCOPE } from '../../../../modules/pdf-catalog/site-scope';
import { PDF_CATALOG_MODULE } from '../../../../modules/pdf-catalog';
import type PdfCatalogModuleService from '../../../../modules/pdf-catalog/service';

/**
 * GET /admin/pdf-catalogs/file?id=<file_id> — streamea el PDF por el backend.
 *
 * El bucket (DO Spaces) no manda headers CORS, así que react-pdf no puede
 * fetchear la URL pública desde el admin; este proxy same-origin lo evita.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Query param "id" is required');
  }

  /**
   * El `id` es un file_id del bucket, no una fila nuestra: sin esto, cualquiera con un
   * file_id se baja el catálogo de otra tienda. Se resuelve al revés — se buscan los
   * catálogos de la tienda y se exige que alguno apunte a ESE archivo.
   */
  const catalogService = req.scope.resolve<PdfCatalogModuleService>(PDF_CATALOG_MODULE);
  const ownCatalogs = await catalogService.listPdfCatalogs({
    pdf_file_id: id,
    ...(await siteFilter(req.scope, await siteFromRequest(req), PDF_CATALOG_SITE_SCOPE)),
  });
  if (ownCatalogs.length === 0) {
    // 404 y no 403: un 403 confirmaría que el archivo existe en otra tienda.
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }

  const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);
  const stream = await fileModule.getDownloadStream(id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, max-age=300');
  stream.on('error', () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  stream.pipe(res);
}
