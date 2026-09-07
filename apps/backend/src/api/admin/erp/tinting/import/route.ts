import type { Logger } from '@medusajs/framework/types';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import { summarizeImportedColorImages } from '../../../../../modules/erp/tinting/color-images';
import {
  parseBaseRows,
  parseColorRows,
  parseFormulaRows,
  readRawRows,
} from '../../../../../modules/erp/tinting/import-rows';
import type { PostErpTintingImportType } from '../../validators';

/**
 * POST /admin/erp/tinting/import — carga la data maestra tintométrica.
 *
 * Acepta `csv` (texto pegado de la planilla del fabricante) o `rows` (JSON), y
 * arranca en **dry run**: sin `dry_run: false` explícito devuelve el diff y no
 * escribe nada. Es a propósito — una carta mal mapeada se nota recién cuando un
 * cliente elige un color y el ERP contesta "no existe".
 *
 * `kind`:
 * - `colors`   → la carta: `code`, `name`, `collection` (+ `hex`, `family`, `rank`,
 *                `imagenes`). Las fotos de ambiente van como
 *                `Livingroom=https://…|Kitchen=https://…` (o JSON, si se manda por
 *                `rows`) y distinguen **ausente de vacía**: si la columna está y la
 *                celda viene vacía se borran las fotos de ese color; si la columna
 *                no está, quedan como estaban. Es a propósito — la planilla del
 *                fabricante no trae fotos y no puede pisar el harvest.
 *                La respuesta incluye `images` con el recuento: una carta sin
 *                fotos entra sin un solo error y hasta ahora terminaba en verde
 *                sin que nadie supiera que el carrusel del storefront iba a
 *                quedar vacío.
 * - `formulas` → el índice que hace posible cotizar: `color_code`, `collection`,
 *                `product_line`, `zeus_formula_code` (+ `base_letter`)
 * - `bases`    → qué artículo es base entonable: `article_code`, `product_line`
 *                (+ `base_letter`, `collection`, `size_label`)
 *
 * Los nombres de columna aceptan alias en castellano (`codigo`, `nombre`,
 * `carta`, `linea`, `letra`, `formula`), que es como vienen las planillas reales.
 */
export async function POST(
  req: MedusaRequest<PostErpTintingImportType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const raw = readRawRows({ rows: body.rows, csv: body.csv });
  if (!raw.length) {
    res.status(400).json({
      message: 'No llegó ninguna fila. Mandá `csv` con el texto de la planilla o `rows` como JSON.',
    });
    return;
  }

  // Default seguro: si no dice explícitamente que escriba, es un preview.
  const dryRun = body.dry_run !== false;

  if (body.kind === 'colors') {
    const parsed = parseColorRows(raw);
    const result = await service.upsertTintingColors(parsed.rows, { dryRun });

    /**
     * Las fotos se informan SIEMPRE, tengan o no. Una carta sin fotos entra sin
     * un solo error —son opcionales, y la planilla del fabricante nunca las
     * trae— así que el import terminaba en verde y nadie sabía que la mitad de
     * la feature no iba a funcionar. Pasó en desdeelsur con los 2848 colores y
     * se descubrió por un reclamo de una clienta.
     */
    const images = summarizeImportedColorImages(parsed.rows);
    if (parsed.rows.length && images.with_images === 0) {
      logger.warn(
        `[erp] tintométrico: se importaron ${parsed.rows.length} colores y NINGUNO trae fotos de ambiente` +
          (images.column_present
            ? ' (la columna vino, pero vacía en todas las filas).'
            : ' (la planilla no trae la columna de fotos).') +
          ' El carrusel de "así queda este color" va a quedar vacío en el storefront.' +
          ' Las fotos salen de otra corrida: scripts/tinting/harvest-alba-colors.mjs' +
          ' — ver docs/recipes/erp-tinting-carta-alba.md.'
      );
    }

    res.json({
      kind: body.kind,
      dry_run: dryRun,
      ...result,
      images,
      skipped: parsed.errors.length,
      errors: parsed.errors,
    });
    return;
  }

  if (body.kind === 'formulas') {
    const parsed = parseFormulaRows(raw);
    const result = await service.upsertTintingFormulas(parsed.rows, { dryRun });
    res.json({ kind: body.kind, dry_run: dryRun, ...result, skipped: parsed.errors.length, errors: parsed.errors });
    return;
  }

  const parsed = parseBaseRows(raw);
  const result = await service.upsertTintingBases(
    parsed.rows.map((row) => ({ ...row, source: 'manual' as const })),
    // Una base cargada a mano en una planilla ya es una decisión humana: no
    // tiene sentido pedir una segunda confirmación como con el parser.
    { dryRun, confirmOnCreate: true }
  );
  res.json({
    kind: body.kind,
    dry_run: dryRun,
    ...result,
    skipped: parsed.errors.length,
    errors: parsed.errors,
  });
}
