import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../../modules/recommendations';
import type RecommendationEngineModuleService from '../../../../../modules/recommendations/service';

const MANUAL_STRATEGY_KEY = 'manual';

/**
 * POST /admin/recommendations/relations/bulk — un producto origen, N destinos.
 *
 * Es la forma del flujo real del backoffice ("buscar producto, elegir varios
 * relacionados, guardar") y evita N requests. Es IDEMPOTENTE: los pares que ya
 * existen se informan como `skipped` en lugar de fallar, así reintentar el guardado
 * —o agregar un producto a una selección existente— no explota a mitad de camino
 * dejando la mitad creada.
 *
 * La prioridad se asigna decreciente en el orden recibido, que es el orden en que el
 * merchant los ordenó en la UI.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  const body = req.validatedBody as {
    source_product_id: string;
    target_product_ids: string[];
    relation_type: string;
    priority?: number;
    sales_channel_id?: string | null;
  };

  const targets = [...new Set(body.target_product_ids)].filter(
    (targetId) => targetId !== body.source_product_id,
  );

  const existing = (await service.listRecommendationRelations(
    {
      source_product_id: body.source_product_id,
      relation_type: body.relation_type,
      version_id: null,
    },
    { take: 500 },
  )) as unknown as Array<{ target_product_id: string }>;

  const already = new Set(existing.map((relation) => relation.target_product_id));
  const toCreate = targets.filter((targetId) => !already.has(targetId));

  const basePriority = body.priority ?? targets.length;
  const created = toCreate.length
    ? ((await service.createRecommendationRelations(
        toCreate.map((targetId, index) => ({
          source_product_id: body.source_product_id,
          target_product_id: targetId,
          relation_type: body.relation_type,
          strategy_key: MANUAL_STRATEGY_KEY,
          origin: 'merchant',
          version_id: null,
          priority: Math.max(0, basePriority - index),
          is_active: true,
          sales_channel_id: body.sales_channel_id ?? null,
          created_by: (req.auth_context?.actor_id as string) ?? null,
        })) as never,
      )) as unknown as Array<Record<string, unknown>>)
    : [];

  res.status(201).json({
    created: created.length,
    skipped: targets.length - toCreate.length,
    // Los destinos que coincidían con el origen se descartan en silencio: un
    // producto no puede recomendarse a sí mismo.
    ignored_self: body.target_product_ids.filter((id) => id === body.source_product_id).length,
    relations: created,
  });
}
