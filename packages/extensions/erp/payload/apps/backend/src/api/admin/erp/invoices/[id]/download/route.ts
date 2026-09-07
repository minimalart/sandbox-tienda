import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';
import type { ErpInvoiceRow } from '../../../../../../modules/erp/service';

/**
 * GET /admin/erp/invoices/:id/download — streamea el PDF del comprobante.
 *
 * El PDF se sirve por proxy y NUNCA por URL directa. El endpoint del ERP que lo
 * emite acepta el JWT como query param, y ese token lee el catálogo, crea
 * clientes y crea pedidos: no puede aparecer en ninguna URL. Mismo patrón que
 * `api/admin/fiscal-documents/[id]/download`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);

  const invoice = (await service
    .retrieveErpInvoice(id)
    .catch(() => null)) as ErpInvoiceRow | null;

  if (!invoice) {
    res.status(404).json({ message: 'Comprobante no encontrado.' });
    return;
  }
  if (!invoice.file_id) {
    res.status(404).json({
      message:
        'Este comprobante todavía no tiene PDF. Los datos fiscales ya están; el PDF se vuelve a pedir en el próximo intento.',
    });
    return;
  }

  const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);
  const stream = await fileModule.getDownloadStream(invoice.file_id);

  const label = [invoice.tipo_comp, invoice.letra, invoice.numero_comp]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join('-')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', `inline; filename="comprobante-${label || id}.pdf"`);
  stream.on('error', () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  stream.pipe(res);
}
