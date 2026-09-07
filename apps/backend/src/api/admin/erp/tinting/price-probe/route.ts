import type { Logger } from '@medusajs/framework/types';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import { getErpAdapter } from '../../../../../modules/erp/adapters/registry';
import { ErpTintingFormulaNotFoundError } from '../../../../../modules/erp/adapters/types';
import { normalizeTintingQuote } from '../../../../../modules/erp/tinting/normalize-quote';
import { DEFAULT_TINTING_SETTINGS } from '../../../../../modules/erp/types';
import type { ErpConfigSettings } from '../../../../../modules/erp/types';
import type { PostErpTintingProbeType } from '../../validators';

/**
 * POST /admin/erp/tinting/price-probe — cotiza un par base + fórmula CRUDO contra
 * el ERP, sin pasar por la data maestra.
 *
 * Sirve para dos cosas concretas:
 * 1. Probar un código de fórmula ANTES de importarlo (el formato no es adivinable
 *    y el ERP sólo dice "no existe").
 * 2. Contrastar contra la pantalla de Zeus Gestión. Es lo que confirma el único
 *    supuesto que quedó abierto: si `total` viene con IVA. Devuelve la cotización
 *    a cantidad 1 y 2 para que el ratio se vea de una.
 *
 * Caso conocido de la cuenta real: base `113` + fórmula `00NN 16/000` en la lista
 * 1 devuelve 66.352,822 (y 132.705,645 a cantidad 2).
 */
export async function POST(
  req: MedusaRequest<PostErpTintingProbeType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const config = await service.getActiveConfig();
  if (!config) {
    res.status(400).json({ message: 'La extensión ERP no está configurada.' });
    return;
  }

  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCapabilities().tinting_price || !adapter.getTintingPrice) {
    res.status(400).json({ message: `El ERP ${config.provider} no cotiza entonados.` });
    return;
  }

  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    res.status(400).json({ message: 'No hay credenciales del ERP guardadas.' });
    return;
  }

  const settings = (config.settings ?? {}) as ErpConfigSettings;
  const listIndex =
    body.list_index ??
    settings.catalog_sync?.base_list_index ??
    1;
  const ctx = {
    credentials,
    settings: settings as unknown as Record<string, unknown>,
    countryCode: config.country_code,
    logger,
  };

  const quoteFor = async (quantity: number) =>
    adapter.getTintingPrice!(
      {
        base_code: body.base_code,
        formula_code: body.formula_code,
        list_index: listIndex,
        quantity,
      },
      ctx
    );

  try {
    const one = await quoteFor(1);
    // La segunda cotización es la que revela si `total` es unitario o de la
    // línea. Si falla (rate limit, blip), el probe sigue sirviendo con una sola.
    const two = await quoteFor(2).catch(() => null);

    const includesTax = settings.tinting?.total_includes_tax ?? DEFAULT_TINTING_SETTINGS.total_includes_tax;
    const normalized = normalizeTintingQuote({
      raw: { total: one.total, tax_rate: one.tax_rate },
      quantity: 1,
      includes_tax: includesTax,
    });

    res.json({
      base_code: one.base_code,
      formula_code: one.formula_code,
      list_index: listIndex,
      raw: {
        quantity_1: { total: one.total, poriva: one.tax_rate },
        quantity_2: two ? { total: two.total, poriva: two.tax_rate } : null,
      },
      // 2.0 ⇒ `total` es de la línea (lo medido); 1.0 ⇒ sería unitario.
      quantity_ratio: two && one.total > 0 ? Number((two.total / one.total).toFixed(6)) : null,
      normalized,
      assumptions: {
        total_includes_tax: includesTax,
        note: 'Comparar `raw.quantity_1.total` contra el precio que muestra Zeus Gestión para 1 envase: si coincide, el total viene con IVA.',
      },
    });
  } catch (error) {
    if (error instanceof ErpTintingFormulaNotFoundError) {
      res.status(422).json({
        message: `El ERP no reconoce la fórmula ${body.formula_code} para la base ${body.base_code}.`,
        hint: 'El código va sin espacios y tiene que existir en Zeus Gestión. Verificá también que la fórmula aplique a esa base.',
      });
      return;
    }
    const detail = error instanceof Error ? error.message : String(error);
    res.status(424).json({ message: 'No pudimos cotizar contra el ERP.', detail });
  }
}
