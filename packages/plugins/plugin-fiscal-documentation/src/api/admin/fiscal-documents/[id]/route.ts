import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { FISCAL_DOCUMENTATION_MODULE } from '../../../../modules/fiscal-documentation';
import type FiscalDocumentationModuleService from '../../../../modules/fiscal-documentation/service';

import { assertFiscalDocumentInSite } from '../_helpers';

/** GET /admin/fiscal-documents/:id — un documento. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
  // CUIT y domicilio fiscal adentro.
  await assertFiscalDocumentInSite(req, req.params.id as string);

  const service = req.scope.resolve<FiscalDocumentationModuleService>(FISCAL_DOCUMENTATION_MODULE);
  const id = req.params.id as string;
  const fiscal_document = await service.retrieveFiscalDocument(id);
  res.json({ fiscal_document });
}

/**
 * DELETE /admin/fiscal-documents/:id — baja lógica (soft delete). No borra el
 * PDF del File module ni rompe el historial; solo lo oculta de los listados.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
  // CUIT y domicilio fiscal adentro.
  await assertFiscalDocumentInSite(req, req.params.id as string);

  const service = req.scope.resolve<FiscalDocumentationModuleService>(FISCAL_DOCUMENTATION_MODULE);
  const id = req.params.id as string;
  await service.softDeleteFiscalDocuments([id]);
  res.json({ id, deleted: true });
}
