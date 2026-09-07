import { MedusaError } from '@medusajs/framework/utils';
import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../modules/recommendations';
import type RecommendationEngineModuleService from '../../../../modules/recommendations/service';
import { loadProductCards, resolvePriceRegion, type ProductCard } from '../helpers';

import { siteFromRequest } from '../../../../lib/multistore/request';

const MANUAL_STRATEGY_KEY = 'manual';

/**
 * GET /admin/recommendations/relations — relaciones MANUALES, con las cards de los
 * productos involucrados.
 *
 * Sólo manuales (`version_id is null`): las calculadas son cientos de miles de filas
 * regeneradas por cada build y no son editables, así que no tienen lugar en una
 * pantalla de administración. Se listan por la pantalla de Rendimiento y el log de
 * versiones (fases 5 y 9).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  const query = req.validatedQuery as {
    source_product_id?: string;
    target_product_id?: string;
    relation_type?: string;
    is_active?: 'true' | 'false';
    limit?: number;
    offset?: number;
  };

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const filters: Record<string, unknown> = { version_id: null };

  // `NULL` = relación de todos los canales. Se incluye junto a las de la tienda: una
  // relación global que no aparece hace que el operador la vuelva a crear duplicada.
  const relResolution = await siteFromRequest(req);
  if (relResolution.status === 'site') {
    filters.sales_channel_id = [...relResolution.site.channel_ids, null];
  }
  if (query.source_product_id) filters.source_product_id = query.source_product_id;
  if (query.target_product_id) filters.target_product_id = query.target_product_id;
  if (query.relation_type) filters.relation_type = query.relation_type;
  if (query.is_active) filters.is_active = query.is_active === 'true';

  const [relations, count] = (await service.listAndCountRecommendationRelations(filters, {
    take: limit,
    skip: offset,
    order: { source_product_id: 'ASC', priority: 'DESC', created_at: 'ASC' },
  })) as unknown as [Array<Record<string, unknown>>, number];

  const price = await resolvePriceRegion(req);
  const cards = await loadProductCards(
    req,
    relations.flatMap((relation) => [
      relation.source_product_id as string,
      relation.target_product_id as string,
    ]),
    price,
  );

  res.status(200).json({
    relations: relations.map((relation) => ({
      ...relation,
      // `null` significa "el producto ya no existe": la UI lo muestra como relación
      // huérfana para que el merchant pueda limpiarla.
      source_product: cards.get(relation.source_product_id as string) ?? null,
      target_product: cards.get(relation.target_product_id as string) ?? null,
    })),
    count,
    offset,
    limit,
  });
}

/** POST /admin/recommendations/relations — crea una relación manual. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  const body = req.validatedBody as Record<string, unknown>;

  // El índice único parcial ya lo garantiza en base; se chequea antes para devolver
  // un mensaje entendible en lugar de un error de constraint.
  const [existing] = (await service.listRecommendationRelations(
    {
      source_product_id: body.source_product_id,
      target_product_id: body.target_product_id,
      relation_type: body.relation_type,
      version_id: null,
    },
    { take: 1 },
  )) as unknown as Array<{ id: string }>;

  if (existing) {
    throw new MedusaError(
      MedusaError.Types.DUPLICATE_ERROR,
      'Ya existe esa relación entre los dos productos con ese tipo.',
    );
  }

  const [created] = (await service.createRecommendationRelations([
    {
      ...body,
      strategy_key: MANUAL_STRATEGY_KEY,
      origin: 'merchant',
      // Explícito: las manuales viven fuera del versionado y nunca quedan
      // superseded por un recálculo.
      version_id: null,
      created_by: (req.auth_context?.actor_id as string) ?? null,
    },
  ] as never)) as unknown as Array<Record<string, unknown>>;

  const price = await resolvePriceRegion(req);
  const cards = await loadProductCards(
    req,
    [body.source_product_id as string, body.target_product_id as string],
    price,
  );

  res.status(201).json({
    relation: {
      ...created,
      source_product: cards.get(body.source_product_id as string) ?? null,
      target_product: cards.get(body.target_product_id as string) ?? null,
    } as Record<string, unknown> & { source_product: ProductCard | null },
  });
}
