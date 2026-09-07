import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CATALOGADOR_MODULE } from '../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../modules/catalogador/service';
import { getCatalogadorConfig } from '../../../../../../modules/catalogador/config';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite, siteDefaults } from '../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../modules/catalogador/site-scope';

/**
 * POST /admin/catalogador/executions/:id/refloat — crea una NUEVA ejecución en
 * borrador basada en una histórica (PRD §20). Copia selección + operaciones. NO
 * reutiliza las propuestas anteriores (para eso está "duplicar"). El usuario
 * elige config histórica o vigente vía body.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El mismo guard que el detalle. Igual que duplicar: reflotar copia la selección y
  // las operaciones de la corrida origen, así que sin guard se lee la configuración
  // de otra tienda desde una corrida nueva y propia.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const body = (req.body ?? {}) as { use_current_config?: boolean };
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  let source;
  try {
    source = await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }

  const configuration_snapshot = body.use_current_config
    ? { config: await getCatalogadorConfig(req.scope), frozen_at: new Date().toISOString() }
    : source.configuration_snapshot ?? null;

  const [clone] = await service.createCatalogingExecutions([
    {
      name: `${source.name} (reflote)`,
      status: 'draft',
      kind: 'enrichment',
      created_by: actorId,
      // Sin esto el reflote nacía con `site_id NULL`, que con `empty: 'all'` no es
      // "de nadie" sino visible desde TODAS las tiendas. Misma tienda activa que el
      // create normal (`executions/route.ts:85`), no la del origen: heredar de una
      // ejecución global propagaría el NULL a cada reflote siguiente.
      ...siteDefaults(await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE),
      selection_definition: source.selection_definition ?? null,
      selection_count: source.selection_count,
      configuration_snapshot,
      duplicated_from_execution_id: source.id,
    },
  ]);
  if (!clone) throw new Error('No se pudo reflotar la ejecución');

  const products = await service.listCatalogingExecutionProducts(
    { execution_id: id },
    { take: null as unknown as number }
  );
  if (products.length) {
    await service.createCatalogingExecutionProducts(
      products.map((p) => ({ execution_id: clone.id, product_id: p.product_id, status: 'pending' as const }))
    );
  }

  const operations = await service.listCatalogingOperations({ execution_id: id });
  if (operations.length) {
    await service.createCatalogingOperations(
      operations.map((o) => ({
        execution_id: clone.id,
        type: o.type,
        field: o.field,
        configuration: o.configuration ?? null,
        status: 'pending' as const,
      }))
    );
  }

  await service.logActivity({
    execution_id: clone.id,
    type: 'refloated',
    actor_id: actorId,
    metadata: { from: source.id, use_current_config: Boolean(body.use_current_config) },
  });
  await service.recomputeProgress(clone.id);

  res.status(201).json({ execution: clone });
}
