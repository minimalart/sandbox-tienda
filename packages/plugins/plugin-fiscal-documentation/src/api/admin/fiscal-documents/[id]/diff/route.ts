import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { FISCAL_DOCUMENTATION_MODULE } from '../../../../../modules/fiscal-documentation';
import type FiscalDocumentationModuleService from '../../../../../modules/fiscal-documentation/service';

import { assertFiscalDocumentInSite } from '../../_helpers';

/**
 * GET /admin/fiscal-documents/:id/diff[?against=<otherId>] — diferencias entre
 * este documento y otro (o la versión inmediatamente anterior del mismo owner).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: un id adivinado baja la constancia de otra tienda, con
  // CUIT y domicilio fiscal adentro.
  await assertFiscalDocumentInSite(req, req.params.id as string);

  const service = req.scope.resolve<FiscalDocumentationModuleService>(FISCAL_DOCUMENTATION_MODULE);
  const id = req.params.id as string;
  const against = typeof req.query.against === 'string' ? req.query.against : undefined;

  try {
    const result = await service.compare(id, against);
    res.json({
      before: { id: result.before.id, created_at: result.before.created_at },
      after: { id: result.after.id, created_at: result.after.created_at },
      changes: result.changes,
      changed: result.changes.length > 0,
    });
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND) {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error instanceof MedusaError && error.type === MedusaError.Types.INVALID_DATA) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
}
