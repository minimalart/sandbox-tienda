import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';
import { baseDetectionTitle } from '../../../../../../modules/erp/tinting/base-detection-title';
import { parseTintingBase } from '../../../../../../modules/erp/tinting/parse-base';
import type { PostErpTintingDetectBasesType } from '../../../validators';

type VariantRow = {
  id: string;
  sku?: string | null;
  title?: string | null;
  /** Donde el catalog sync deja el título CRUDO del ERP (`zeus_source_title`). */
  metadata?: Record<string, unknown> | null;
  product?: { title?: string | null } | null;
};

/**
 * POST /admin/erp/tinting/bases/detect — encuentra las bases entonables entre las
 * variantes de Medusa parseando la descripción.
 *
 * Corre sobre lo que HAY en Medusa (no sobre el catálogo del ERP) porque una base
 * que no está en la tienda no se puede vender entonada igual. Es la contraparte
 * de `bases/sync-products`, que crea las que faltan: ésta registra las que ya
 * llegaron por otro camino, típicamente el catalog sync.
 *
 * Parsea el título CRUDO del ERP y no el del producto: el normalizador le saca
 * justamente el `Base F` (regla R26), así que leer el título de Medusa dejaba
 * fuera del detector a todas las bases que entraron por el sync — que son
 * exactamente las que esta ruta tiene que cubrir. Ver `baseDetectionTitle`.
 *
 * Arranca en preview: sin `commit: true` sólo devuelve qué detectó. Las filas se
 * escriben SIN confirmar — confirmar es un acto humano, porque un falso positivo
 * publicaría un pincel como entonable. Se confirman con
 * `POST /admin/erp/tinting/bases/confirm`.
 *
 * Hoy el parser es la única fuente: Zeus TIENE los campos
 * (`agrupacion_tintometrico`, `codigo_color`, `acabado`, `tamanio`) pero están
 * vacíos en los 3438 artículos de la cuenta real.
 */
export async function POST(
  req: MedusaRequest<PostErpTintingDetectBasesType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // Barrido paginado, no un `take` grande: la tienda tiene más de 10.000
  // variantes y un tope fijo dejaba bases sin escanear SIN avisar (que es lo peor
  // que puede hacer un detector: parecer que cubrió todo).
  const PAGE = 1_000;
  const MAX_PAGES = 200;
  const variants: VariantRow[] = [];
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data } = (await query.graph({
      entity: 'product_variant',
      // `metadata` no es opcional acá: es donde vive el título crudo del ERP, y
      // sin él el detector es ciego a todo lo que pasó por el catalog sync (ver
      // `baseDetectionTitle`).
      fields: ['id', 'sku', 'title', 'metadata', 'product.title'],
      // Sin SKU no hay código de artículo del ERP, así que no se puede cotizar.
      filters: { sku: { $ne: null } },
      pagination: { take: PAGE, skip: page * PAGE, order: { id: 'ASC' } },
    })) as { data: VariantRow[] };

    variants.push(...data);
    if (data.length < PAGE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  const detected: Array<{
    article_code: string;
    title: string;
    base_letter: string | null;
    product_line: string;
    size_label: string;
    size_liters: number | null;
    confidence: 'high' | 'low';
  }> = [];

  for (const variant of variants) {
    const sku = variant.sku?.trim();
    if (!sku) continue;
    // El título del ERP es el que trae la forma "… BASE F X 3,6 LTS". OJO: el del
    // producto YA NO la trae si pasó por el normalizador (regla R26 saca el
    // `Base F`), así que la precedencia la decide `baseDetectionTitle` y no se
    // puede volver a leer `product.title` derecho viejo.
    const title = baseDetectionTitle(variant);
    const parsed = parseTintingBase(title);
    if (!parsed) continue;
    if (body.only_high_confidence !== false && parsed.confidence !== 'high') continue;

    detected.push({
      article_code: sku,
      title,
      base_letter: parsed.base_letter,
      product_line: parsed.product_line,
      size_label: parsed.size_label,
      size_liters: parsed.size_liters,
      confidence: parsed.confidence,
    });
  }

  const commit = body.commit === true;
  const result = await service.upsertTintingBases(
    detected.map((row) => ({
      article_code: row.article_code,
      base_letter: row.base_letter,
      product_line: row.product_line,
      collection: body.collection ?? null,
      size_label: row.size_label,
      size_liters: row.size_liters,
      source: 'parsed' as const,
      title_snapshot: row.title,
    })),
    { dryRun: !commit }
  );

  res.json({
    scanned: variants.length,
    // `true` = se alcanzó el tope del barrido y quedaron variantes sin mirar.
    truncated,
    detected: detected.length,
    committed: commit,
    ...result,
    // El listado completo: es lo que el admin muestra para revisar antes de
    // confirmar.
    items: detected,
  });
}
