import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';
import { CATALOGADOR_MODULE } from '../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../modules/catalogador/service';
import { cleanupExecutionFiles } from '../../../../../modules/catalogador/asset-cleanup';
import type { ExecutionStatus } from '../../../../../modules/catalogador/models';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../modules/catalogador/site-scope';

export const UpdateExecutionSchema = z.object({
  name: z.string().min(1).optional(),
});

/** GET /admin/catalogador/executions/:id — detalle con productos/operaciones/actividad. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: cancelar o reanudar la corrida de otra tienda le corta un
  // proceso que no lanzó.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;

  let execution;
  try {
    execution = await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }

  const products = await service.listCatalogingExecutionProducts(
    { execution_id: id },
    { take: null as unknown as number, order: { created_at: 'ASC' } }
  );
  const operations = await service.listCatalogingOperations({ execution_id: id });
  const activity = await service.listCatalogingActivities(
    { execution_id: id },
    { take: 200, order: { created_at: 'DESC' } }
  );
  const assetProposals = products.length
    ? await service.listCatalogingAssetProposals(
        { execution_product_id: products.map((p) => p.id) },
        { take: null as unknown as number }
      )
    : [];

  // Adjunta título/thumbnail de cada producto para la tabla de validación (la UI
  // muestra el producto, no el id crudo).
  let productsEnriched = products as Array<Record<string, unknown>>;
  if (products.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: 'product',
      fields: ['id', 'title', 'thumbnail', 'handle'],
      filters: { id: products.map((p) => p.product_id) },
    });
    const info = new Map(
      (data as Array<{ id: string; title?: string; thumbnail?: string; handle?: string }>).map((p) => [
        p.id,
        p,
      ])
    );
    productsEnriched = products.map((p) => ({
      ...p,
      product_title: info.get(p.product_id)?.title ?? null,
      product_thumbnail: info.get(p.product_id)?.thumbnail ?? null,
      product_handle: info.get(p.product_id)?.handle ?? null,
    }));
  }

  res
    .status(200)
    .json({ execution, products: productsEnriched, operations, activity, asset_proposals: assetProposals });
}

/** PATCH /admin/catalogador/executions/:id — renombrar (u otros metadatos livianos). */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: cancelar o reanudar la corrida de otra tienda le corta un
  // proceso que no lanzó.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const body = req.validatedBody as z.infer<typeof UpdateExecutionSchema>;

  try {
    await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }

  const [execution] = await service.updateCatalogingExecutions([{ id, ...body }]);
  res.status(200).json({ execution });
}

/** DELETE /admin/catalogador/executions/:id — sólo borradores/canceladas/error (PRD §9.5). */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: cancelar o reanudar la corrida de otra tienda le corta un
  // proceso que no lanzó.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;

  let execution;
  try {
    execution = await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }

  if (!service.isDeletable(execution.status as ExecutionStatus)) {
    res.status(409).json({
      type: 'not_allowed',
      message: 'Una ejecución aplicada o en proceso no se puede eliminar.',
    });
    return;
  }

  // Antes de borrar la fila: `deleteCatalogingExecutions` no cascadea (los hijos
  // cuelgan por FK de texto, no por relación MikroORM), así que sin este barrido los
  // archivos quedaban en el storage sin nada en la base que los nombrara.
  // `isDeletable` sólo admite draft/cancelled/error, así que nada está aplicado.
  await cleanupExecutionFiles(req.scope, id, { deleteRows: true });
  await service.deleteCatalogingExecutions([id]);
  res.status(200).json({ id, deleted: true });
}
