import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CATALOGADOR_MODULE } from '../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../modules/catalogador/service';
import { cleanupExecutionFiles } from '../../../../../../modules/catalogador/asset-cleanup';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../modules/catalogador/site-scope';

/** POST /admin/catalogador/executions/:id/cancel — cancela antes de aplicar (PRD §8). */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El mismo guard que el detalle: cancelar la corrida de otra tienda le corta un
  // proceso que no lanzó, y el estado `cancelled` no tiene vuelta atrás desde acá.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  let execution;
  try {
    execution = await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }

  const blocked = ['applied', 'partially_applied', 'applying', 'restored'];
  if (blocked.includes(execution.status as string)) {
    res.status(409).json({
      type: 'not_allowed',
      message: `No se puede cancelar una ejecución en estado "${execution.status}".`,
    });
    return;
  }

  await service.setStatus(id, 'cancelled');
  // Cancelar deja de ser gratis en storage: los estados bloqueados de arriba
  // garantizan que nada se aplicó, así que TODO lo que la corrida generó es residuo.
  const swept = await cleanupExecutionFiles(req.scope, id);
  await service.logActivity({
    execution_id: id,
    type: 'cancelled',
    actor_id: actorId,
    metadata: swept.proposals ? { files_deleted: swept.deleted, proposals: swept.proposals } : null,
  });
  const execAfter = await service.retrieveCatalogingExecution(id);
  res.status(200).json({ execution: execAfter });
}
