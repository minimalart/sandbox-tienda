import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CATALOGADOR_MODULE } from '../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../modules/catalogador/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite, siteDefaults } from '../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../modules/catalogador/site-scope';

/**
 * POST /admin/catalogador/executions/:id/restore — crea una ejecución de tipo
 * Restauración (PRD §19.4/§20) que reescribe los valores previos (`pre`
 * snapshot) de los productos afectados. Nunca elimina el historial original. La
 * detección de conflictos (cambios posteriores) ocurre al aplicar, comparando
 * contra lo último que escribió la ejecución original (`post` snapshot).
 *
 * body: { product_ids?: string[] } — restaura sólo esos; si falta, toda la ejecución.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El mismo guard que el detalle, y de los más caros: la restauración nace
  // `ready_to_apply` con los snapshots `pre` de la corrida origen ya cargados como
  // `accepted_changes`. Sin guard, un id ajeno alcanza para armar —y después
  // aplicar— un rollback del catálogo de otra tienda.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const body = (req.body ?? {}) as { product_ids?: string[] };
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  let source;
  try {
    source = await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }
  if (!['applied', 'partially_applied'].includes(source.status as string)) {
    res.status(409).json({
      type: 'not_allowed',
      message: 'Sólo se puede restaurar una ejecución aplicada.',
    });
    return;
  }

  const preSnaps = await service.listCatalogingSnapshots(
    { execution_id: id, type: 'pre' },
    { take: null as unknown as number }
  );
  const postSnaps = await service.listCatalogingSnapshots(
    { execution_id: id, type: 'post' },
    { take: null as unknown as number }
  );
  const postByProduct = new Map(postSnaps.map((s) => [s.product_id, s.data]));

  const filter = (s: { product_id: string }) =>
    !body.product_ids?.length || body.product_ids.includes(s.product_id);
  const targets = preSnaps.filter(filter);

  if (targets.length === 0) {
    res.status(409).json({ type: 'not_allowed', message: 'No hay snapshots previos para restaurar.' });
    return;
  }

  const [restoration] = await service.createCatalogingExecutions([
    {
      name: `Restauración de ${source.name}`,
      status: 'ready_to_apply',
      kind: 'restoration',
      created_by: actorId,
      // Sin esto la restauración nacía con `site_id NULL`, que con `empty: 'all'` es
      // visible desde TODAS las tiendas. Misma tienda activa que el create normal
      // (`executions/route.ts:85`), no la del origen.
      ...siteDefaults(await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE),
      restored_from_execution_id: source.id,
      selection_count: targets.length,
    },
  ]);
  if (!restoration) throw new Error('No se pudo crear la restauración');

  await service.createCatalogingExecutionProducts(
    targets.map((snap) => ({
      execution_id: restoration.id,
      product_id: snap.product_id,
      status: 'accepted' as const,
      // Escribimos de vuelta los valores previos.
      accepted_changes: (snap.data ?? {}) as Record<string, unknown>,
      // Base de conflictos: lo último que dejó la ejecución original.
      current_snapshot: (postByProduct.get(snap.product_id) ?? {}) as Record<string, unknown>,
    }))
  );

  await service.logActivity({
    execution_id: restoration.id,
    type: 'restored',
    actor_id: actorId,
    metadata: { from: source.id, products: targets.length },
  });
  await service.recomputeProgress(restoration.id);

  res.status(201).json({ execution: restoration });
}
