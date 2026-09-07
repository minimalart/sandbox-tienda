import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';
import type { PostErpTintingConfirmBasesType } from '../../../validators';
import { resolveTintingReadiness } from '../../../../../../modules/erp/tinting/readiness';

/**
 * POST /admin/erp/tinting/bases/confirm — habilita (o deshabilita) bases
 * detectadas.
 *
 * La confirmación es lo que hace que el storefront ofrezca entonado sobre esa
 * base: `resolveTintingSelection` y `listTintingColorsForBase` filtran por
 * `confirmed: true`. Está separado del detector a propósito — que un regex
 * publique un producto como entonable sin que nadie lo mire es exactamente lo que
 * no queremos.
 */
export async function POST(
  req: MedusaRequest<PostErpTintingConfirmBasesType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);

  const updated = await service.setTintingBasesConfirmed(
    body.article_codes,
    body.confirmed !== false
  );

  if (!updated) {
    res.status(404).json({
      message: 'Ninguno de esos códigos está cargado como base. Corré primero el detector.',
    });
    return;
  }

  res.json({
    updated,
    confirmed: body.confirmed !== false,
    readiness: await resolveTintingReadiness(req.scope, service),
  });
}
