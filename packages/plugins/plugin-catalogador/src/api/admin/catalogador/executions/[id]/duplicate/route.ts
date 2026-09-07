import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CATALOGADOR_MODULE } from '../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../modules/catalogador/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite, siteDefaults } from '../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../modules/catalogador/site-scope';

/**
 * POST /admin/catalogador/executions/:id/duplicate — clona una ejecución como
 * nuevo BORRADOR, copiando selección + operaciones + config y TAMBIÉN las
 * propuestas ya generadas (a diferencia de "reflotar", que no las reutiliza —
 * PRD §20).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El mismo guard que el detalle. Acá no alcanza con que "sólo lee y clona": el
  // clon se lleva `selection_definition` y `configuration_snapshot` de la corrida
  // origen, así que sin guard esto es un EXPORT de la configuración de otra tienda
  // disfrazado de duplicado.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  let source;
  try {
    source = await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }

  const [clone] = await service.createCatalogingExecutions([
    {
      name: `${source.name} (copia)`,
      status: 'draft',
      kind: 'enrichment',
      created_by: actorId,
      selection_definition: source.selection_definition ?? null,
      selection_count: source.selection_count,
      configuration_snapshot: source.configuration_snapshot ?? null,
      duplicated_from_execution_id: source.id,
      /*
        Sin esto el clon nacía con `site_id NULL`, y como el descriptor tiene
        `empty: 'all'` eso NO significa "de nadie": significa visible desde TODAS
        las tiendas. Duplicar una ejecución de Norte la volvía global, sin error y
        sin que el listado de Norte —que ve los globales— lo delatara.

        Hereda de la TIENDA ACTIVA y no de `source.site_id`, igual que el create
        normal (`executions/route.ts:85`). Heredar del origen propagaría el `NULL`
        de una ejecución global: cada copia de una copia seguiría siendo global, y
        el agujero se reproduciría solo.
      */
      ...siteDefaults(await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE),
    },
  ]);
  if (!clone) throw new Error('No se pudo duplicar la ejecución');

  const products = await service.listCatalogingExecutionProducts(
    { execution_id: id },
    { take: null as unknown as number }
  );
  if (products.length) {
    await service.createCatalogingExecutionProducts(
      products.map((p) => ({
        execution_id: clone.id,
        product_id: p.product_id,
        status: p.status === 'excluded' ? ('excluded' as const) : p.proposed_changes ? ('proposed' as const) : ('pending' as const),
        proposed_changes: p.proposed_changes ?? null,
        current_snapshot: p.current_snapshot ?? null,
        product_version_reference: p.product_version_reference ?? null,
        external_context_summary: p.external_context_summary ?? null,
      }))
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
    type: 'duplicated',
    actor_id: actorId,
    metadata: { from: source.id },
  });
  await service.recomputeProgress(clone.id);

  res.status(201).json({ execution: clone });
}
