import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CATALOGADOR_MODULE } from '../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../modules/catalogador/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../modules/catalogador/site-scope';

/**
 * POST /admin/catalogador/executions/:id/undelete — la saca de la papelera.
 *
 * Se llama `undelete` y no `restore` a propósito: `POST /:id/restore` ya existe y
 * significa algo distinto y mucho más caro —crea una corrida de tipo Restauración
 * que REESCRIBE los valores previos de los productos—. Dos verbos con el mismo
 * nombre en la misma entidad, uno que sólo limpia un `deleted_at` y otro que
 * revierte el catálogo, es un accidente esperando a pasar.
 *
 * No hay gate de estado acá: si la corrida está en la papelera es porque en su
 * momento pasó el gate de `deletable.ts`, y devolverla al listado no dispara nada.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  // El guard NO puede ser `assertIdInSite`, y es la parte no obvia de esta ruta:
  // ese helper pregunta por SQL y su subselect lleva `AND "deleted_at" IS NULL`
  // cableado, así que para una corrida borrada devuelve 404 siempre —incluso para
  // su propia tienda—. `assertRowInSite` evalúa la MISMA regla sobre la fila que ya
  // tenemos en la mano, que para un descriptor `site_column` es exactamente
  // equivalente y no consulta nada.
  const [execution] = await service.listCatalogingExecutions(
    { id },
    { take: 1, withDeleted: true },
  );
  if (!execution) {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }
  assertRowInSite(execution as unknown as Record<string, unknown>, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE);

  if (!(execution as { deleted_at?: Date | null }).deleted_at) {
    res.status(409).json({
      type: 'not_allowed',
      message: 'La ejecución no está en la papelera.',
    });
    return;
  }

  await service.restoreCatalogingExecutions([id]);
  await service.logActivity({
    execution_id: id,
    type: 'undeleted',
    actor_id: actorId,
    metadata: { status: execution.status },
  });

  const execAfter = await service.retrieveCatalogingExecution(id);
  res.status(200).json({ execution: execAfter });
}
