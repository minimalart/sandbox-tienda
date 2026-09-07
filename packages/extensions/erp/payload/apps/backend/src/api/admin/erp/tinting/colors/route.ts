import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import type { TintingColorRow, TintingFormulaRow } from '../../../../../modules/erp/service';
import type { PostErpTintingDeleteColorsType } from '../../validators';
import { resolveTintingReadiness } from '../../../../../modules/erp/tinting/readiness';

/**
 * DELETE /admin/erp/tinting/colors — borra colores de la carta por
 * `(collection, code)`.
 *
 * Faltaba: el import sólo sabía crear y actualizar, así que un color mal cargado
 * (nombre inventado, código que no es el de la fórmula, carta equivocada) quedaba
 * para siempre. Pasó de verdad: el primer color de prueba se cargó con código
 * `COSMOS` en vez del código real de Alba y quedó duplicando una fórmula.
 *
 * Borra también las FÓRMULAS que apuntaban a ese color: dejarlas sería dejar
 * huérfanas filas que el resolver ya no puede usar, y peor, que el detector de
 * "bases con colores" cuenta como si la base tuviera carta.
 */
export async function DELETE(
  req: MedusaRequest<PostErpTintingDeleteColorsType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);

  const codes = body.codes.map((code) => code.trim()).filter(Boolean);
  if (!codes.length) {
    res.status(400).json({ message: 'No llegó ningún código.' });
    return;
  }

  const filters: Record<string, unknown> = { code: codes };
  if (body.collection) filters.collection = body.collection.trim();

  const colors = (await service.listErpTintingColors(filters, {
    take: null,
  })) as unknown as TintingColorRow[];

  if (!colors.length) {
    res.status(404).json({
      message: body.collection
        ? `Ninguno de esos códigos existe en la carta ${body.collection}.`
        : 'Ninguno de esos códigos existe.',
    });
    return;
  }

  // Fórmulas que quedarían huérfanas, por `(color, carta)` — no sólo por código:
  // el mismo código puede existir en dos cartas distintas.
  const pairs = new Set(colors.map((color) => `${color.collection}::${color.code}`));
  const formulas = (await service.listErpTintingFormulas(
    { color_code: colors.map((c) => c.code) },
    { take: null }
  )) as unknown as TintingFormulaRow[];
  const orphaned = formulas.filter((f) => pairs.has(`${f.collection}::${f.color_code}`));

  if (orphaned.length) {
    await service.deleteErpTintingFormulas(orphaned.map((f) => f.id));
  }
  await service.deleteErpTintingColors(colors.map((c) => c.id));

  res.json({
    deleted_colors: colors.length,
    deleted_formulas: orphaned.length,
    items: colors.map((c) => ({ code: c.code, collection: c.collection, name: c.name })),
    readiness: await resolveTintingReadiness(req.scope, service),
  });
}
