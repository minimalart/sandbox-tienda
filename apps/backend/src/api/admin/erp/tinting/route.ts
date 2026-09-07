import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import { resolveTintingReadiness } from '../../../../modules/erp/tinting/readiness';

/**
 * GET /admin/erp/tinting — estado de la data maestra tintométrica.
 *
 * Un solo endpoint de lectura con los tres listados y el `readiness`, que es lo
 * que el admin necesita para saber si puede prender el entonado: sin colores, sin
 * fórmulas, sin ninguna base confirmada o sin ninguna base VENDIBLE, la feature
 * no tiene con qué funcionar. Lo último es `bases_sellable`, y es lo que faltaba:
 * los otros tres se cargan por import y pueden estar los tres en verde sin que
 * exista un solo producto entonable en la tienda.
 *
 * Filtros: `collection`, `q` (código o nombre del color), `limit`, `offset`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);

  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 500);
  const offset = Number(req.query.offset ?? 0) || 0;
  const collection = String(req.query.collection ?? '').trim();
  const q = String(req.query.q ?? '').trim();

  const colorFilters: Record<string, unknown> = {};
  if (collection) colorFilters.collection = collection;
  if (q) colorFilters.$or = [{ code: { $ilike: `%${q}%` } }, { name: { $ilike: `%${q}%` } }];

  const [colors, colorCount] = await service.listAndCountErpTintingColors(colorFilters, {
    take: limit,
    skip: offset,
    order: { collection: 'ASC', rank: 'ASC', name: 'ASC' },
  });

  const [bases, baseCount] = await service.listAndCountErpTintingBases(
    {},
    { take: limit, skip: offset, order: { product_line: 'ASC', size_liters: 'ASC' } }
  );

  const [formulas, formulaCount] = await service.listAndCountErpTintingFormulas(
    collection ? { collection } : {},
    { take: limit, skip: offset, order: { product_line: 'ASC', color_code: 'ASC' } }
  );

  res.json({
    readiness: await resolveTintingReadiness(req.scope, service),
    colors: { items: colors, count: colorCount },
    bases: { items: bases, count: baseCount },
    formulas: { items: formulas, count: formulaCount },
    limit,
    offset,
  });
}
