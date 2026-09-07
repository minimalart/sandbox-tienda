import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CATALOGADOR_MODULE } from '../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../modules/catalogador/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../modules/catalogador/site-scope';

/**
 * POST /admin/catalogador/executions/:id/apply
 *
 * Marca la ejecución como `applying`. La aplicación real (snapshots + update de
 * productos, con detección de conflictos y éxito parcial) corre en segundo plano
 * (job catalogador-process → applyExecution). Sólo se aplican productos con
 * status 'accepted' (PRD §18.1).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El mismo guard que el detalle: aplicar es la mutación MÁS cara del módulo —
  // reescribe campos del catálogo y deja snapshots—, así que dispararla sobre la
  // corrida de otra tienda le cambia productos a alguien que ni se entera.
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

  // `applied` está en la lista y es seguro: el guard de abajo corta con 409 si no
  // hay NINGÚN producto en estado `accepted`, y un producto ya aplicado queda en
  // `applied`, no en `accepted`. O sea, re-aplicar desde una corrida aplicada sólo
  // puede levantar aprobaciones nuevas — nunca reescribir lo que ya se escribió.
  // Sin esto, todo lo aprobado después de un apply quedaba muerto: 409 por API y
  // botón oculto en el detalle.
  const allowed = [
    'pending_review',
    'partially_reviewed',
    'ready_to_apply',
    'partially_applied',
    'applied',
  ];
  if (!allowed.includes(execution.status as string)) {
    res.status(409).json({
      type: 'not_allowed',
      message: `No se puede aplicar desde el estado "${execution.status}".`,
    });
    return;
  }

  const accepted = await service.listCatalogingExecutionProducts(
    { execution_id: id, status: 'accepted' },
    { take: 1 }
  );
  if (accepted.length === 0) {
    res.status(409).json({
      type: 'not_allowed',
      message: 'No hay cambios aceptados para aplicar.',
    });
    return;
  }

  await service.setStatus(id, 'applying');
  await service.logActivity({ execution_id: id, type: 'apply_started', actor_id: actorId });

  const execAfter = await service.retrieveCatalogingExecution(id);
  res.status(202).json({ execution: execAfter });
}
