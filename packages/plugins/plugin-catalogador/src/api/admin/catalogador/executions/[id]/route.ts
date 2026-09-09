import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';
import { CATALOGADOR_MODULE } from '../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../modules/catalogador/service';
import { deleteBlockReason, isDeletableStatus } from '../../../../../modules/catalogador/deletable';
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

  // Mismo contrato que el listado: el gate de borrado viaja calculado, así el
  // detalle no tiene que reimplementarlo sobre `status`.
  res.status(200).json({
    execution: {
      ...execution,
      deletable: isDeletableStatus(execution.status as ExecutionStatus),
      delete_block_reason: deleteBlockReason(execution.status as ExecutionStatus),
    },
    products: productsEnriched,
    operations,
    activity,
    asset_proposals: assetProposals,
  });
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

/**
 * DELETE /admin/catalogador/executions/:id — borrado LÓGICO (papelera).
 *
 * Antes esto era un `deleteCatalogingExecutions` + un barrido de archivos del
 * storage: irreversible, y por eso sólo se admitía desde `draft`/`cancelled`/
 * `error`. Ahora sólo escribe `deleted_at`, así que la corrida sale del listado y
 * vuelve entera desde la papelera (`POST /:id/undelete`). Los archivos NO se
 * barren: barrerlos haría que "restaurar" devolviera una corrida con las propuestas
 * de imagen apuntando a blobs que ya no existen, y el borrado dejaría de ser
 * reversible justo en el caso en que alguien se arrepiente.
 *
 * Los hijos (`cataloging_execution_product` y compañía) tampoco se tocan: cuelgan
 * por FK de texto, no por relación de MikroORM, así que no cascadean —y no hace
 * falta que lo hagan, porque siempre se listan filtrando por `execution_id` y sin
 * su padre no aparecen en ninguna pantalla—.
 *
 * El gate ampliado vive en `modules/catalogador/deletable.ts`, con tests.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: cancelar o reanudar la corrida de otra tienda le corta un
  // proceso que no lanzó.
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

  const blocked = deleteBlockReason(execution.status as ExecutionStatus);
  if (blocked) {
    res.status(409).json({ type: 'not_allowed', message: blocked });
    return;
  }

  // La actividad se registra ANTES del soft delete: `logActivity` escribe en
  // `cataloging_activity`, que no se borra, y así la papelera conserva quién la
  // mandó ahí y desde qué estado.
  await service.logActivity({
    execution_id: id,
    type: 'deleted',
    actor_id: actorId,
    metadata: { status: execution.status },
  });
  await service.softDeleteCatalogingExecutions([id]);

  res.status(200).json({ id, object: 'cataloging_execution', deleted: true });
}
