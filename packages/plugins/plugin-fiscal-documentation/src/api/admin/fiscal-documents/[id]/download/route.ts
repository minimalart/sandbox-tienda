import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';
import { FISCAL_DOCUMENTATION_MODULE } from '../../../../../modules/fiscal-documentation';
import type FiscalDocumentationModuleService from '../../../../../modules/fiscal-documentation/service';

import { assertFiscalDocumentInSite } from '../../_helpers';

/**
 * GET /admin/fiscal-documents/:id/download — streamea el PDF por el backend.
 * Los PDFs se suben privados (no expone la URL pública del bucket); este proxy
 * autenticado los sirve same-origin.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
  // CUIT y domicilio fiscal adentro.
  await assertFiscalDocumentInSite(req, req.params.id as string);

  const service = req.scope.resolve<FiscalDocumentationModuleService>(FISCAL_DOCUMENTATION_MODULE);
  const id = req.params.id as string;
  const doc = (await service.retrieveFiscalDocument(id)) as { file_id?: string | null; tax_id?: string };

  if (!doc?.file_id) {
    res.status(404).json({ message: 'Este documento no tiene un PDF asociado.' });
    return;
  }

  const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);
  const stream = await fileModule.getDownloadStream(doc.file_id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', `inline; filename="constancia-${doc.tax_id ?? id}.pdf"`);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  stream.pipe(res);
}
