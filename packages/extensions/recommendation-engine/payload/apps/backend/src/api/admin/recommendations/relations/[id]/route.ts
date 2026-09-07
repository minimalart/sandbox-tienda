import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../../modules/recommendations';
import type RecommendationEngineModuleService from '../../../../../modules/recommendations/service';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECOMMENDATION_RELATION_SITE_SCOPE } from '../../../../../modules/recommendations/site-scope';

const serviceOf = (req: MedusaRequest) =>
  req.scope.resolve(RECOMMENDATION_ENGINE_MODULE) as unknown as RecommendationEngineModuleService;

/**
 * POST /admin/recommendations/relations/:id — patch de prioridad, tipo, vigencia o
 * estado activo.
 *
 * No se toca la cache del serve: las relaciones se leen en cada request (sólo se
 * memoiza configuración), así que el cambio se ve en el siguiente pedido.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y dejar la
  // mutación abierta esconde la relación de la otra tienda pero deja repriorizarla con
  // sólo saber el id, y el efecto se ve en su storefront, no en el backoffice de nadie.
  //
  // `assertIdInSite` y no `assertRowInSite` aunque `channel_column` sí se pueda validar
  // leyendo la fila: el handler no la lee antes de mutar (el `retrieve` es posterior al
  // `update`), así que el de fila costaría una lectura extra para el mismo resultado.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECOMMENDATION_RELATION_SITE_SCOPE, id);

  const service = serviceOf(req);
  await service.updateRecommendationRelations({
    id,
    ...(req.validatedBody as Record<string, unknown>),
  } as never);
  const relation = await service.retrieveRecommendationRelation(id);
  res.status(200).json({ relation });
}

/**
 * DELETE /admin/recommendations/relations/:id — soft delete.
 *
 * Soft y no hard: el índice único de relaciones manuales es parcial
 * (`where deleted_at is null`), así que borrar y volver a crear la misma relación
 * funciona sin chocar con la constraint.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  await assertIdInSite(req.scope, await siteFromRequest(req), RECOMMENDATION_RELATION_SITE_SCOPE, id);

  await serviceOf(req).softDeleteRecommendationRelations([id]);
  res.status(200).json({ id, object: 'recommendation_relation', deleted: true });
}
