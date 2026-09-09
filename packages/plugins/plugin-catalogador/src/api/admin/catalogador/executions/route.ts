import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { CATALOGADOR_MODULE } from '../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../modules/catalogador/service';
import { getCatalogadorConfig } from '../../../../modules/catalogador/config';
import { deleteBlockReason, isDeletableStatus } from '../../../../modules/catalogador/deletable';
import type { ExecutionStatus } from '../../../../modules/catalogador/models';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteOf } from '../_shared';
import { siteDefaults } from '../../../../lib/multistore/scope';
import {
  CATALOGING_EXECUTION_SITE_SCOPE,
  executionSiteFilter,
} from '../../../../modules/catalogador/site-scope';

/** Operación elegida en el Paso 2 (campo de texto o de imagen). */
export const OperationInputSchema = z.object({
  type: z.enum(['text_field', 'image_technical', 'image_ai']),
  field: z.string().min(1),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

export const CreateExecutionSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  product_ids: z.array(z.string()).min(1, 'Seleccioná al menos un producto'),
  operations: z.array(OperationInputSchema).min(1, 'Elegí al menos una mejora'),
  selection_definition: z.record(z.string(), z.unknown()).optional(),
});

type CreateExecutionInput = z.infer<typeof CreateExecutionSchema>;

/** GET /admin/catalogador/executions — lista paginada con filtros. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);

  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  // `?deleted=only` es la PAPELERA: sólo las corridas mandadas a borrar. Sin el
  // param, el listado normal —que es lo que ve el 99% de las visitas— no cambia.
  // No hay un tercer modo "todas juntas" a propósito: mezclar vivas y borradas en
  // una tabla paginada obliga a mirar una columna para saber si lo que estás por
  // abrir todavía existe.
  const trash = req.query.deleted === 'only';

  const filters: Record<string, unknown> = {};
  // Scopea el HISTORIAL, no el efecto: el producto enriquecido es compartido por toda
  // la instancia. Es para que el operador vea sus corridas sin el ruido de las demás.
  Object.assign(filters, executionSiteFilter(await siteFromRequest(req)));
  if (typeof req.query.status === 'string' && req.query.status) filters.status = req.query.status;
  if (typeof req.query.created_by === 'string' && req.query.created_by) {
    filters.created_by = req.query.created_by;
  }
  if (typeof req.query.kind === 'string' && req.query.kind) filters.kind = req.query.kind;
  if (q) filters.name = { $ilike: `%${q}%` };
  // `withDeleted` solo trae vivas Y borradas mezcladas: el `$ne: null` es el que
  // deja la papelera en sólo-borradas.
  if (trash) filters.deleted_at = { $ne: null };

  const [executions, count] = await service.listAndCountCatalogingExecutions(filters, {
    skip: offset,
    take: limit,
    order: trash ? { deleted_at: 'DESC' } : { created_at: 'DESC' },
    withDeleted: trash,
  });

  // La regla de quién se puede borrar viaja CALCULADA por fila, en vez de que la
  // UI la reimplemente sobre `status`. Es la diferencia entre una regla y dos: el
  // día que un estado cambie de lado, el menú del listado cambia con él sin que
  // nadie tenga que acordarse de tocar el admin. `delete_block_reason` es además el
  // texto que el menú muestra, así que el motivo lo escribe el dueño de la regla.
  const withGate = executions.map((execution) => ({
    ...execution,
    deletable: isDeletableStatus(execution.status as ExecutionStatus),
    delete_block_reason: deleteBlockReason(execution.status as ExecutionStatus),
  }));

  res.status(200).json({ executions: withGate, count, offset, limit, deleted: trash });
}

/**
 * POST /admin/catalogador/executions — crea una ejecución en borrador con la
 * selección exacta de productos (IDs) y las operaciones elegidas. NO genera
 * propuestas todavía (eso lo dispara /generate). PRD §10-§12.
 */
export async function POST(
  req: MedusaRequest<CreateExecutionInput>,
  res: MedusaResponse
): Promise<void> {
  const input = req.validatedBody as CreateExecutionInput;
  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const actorId = (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  // Con el siteId: el tope de productos por ejecución es configurable POR tienda,
  // y sin él se valida contra el global (ver nota en `_shared.ts`).
  const config = await getCatalogadorConfig(req.scope, await siteOf(req));
  const max = config.limits.max_products_per_execution;
  const productIds = Array.from(new Set(input.product_ids));
  if (productIds.length > max) {
    res.status(400).json({
      type: 'invalid_data',
      message: `La selección (${productIds.length}) supera el máximo por ejecución (${max}).`,
    });
    return;
  }

  const [execution] = await service.createCatalogingExecutions([
    {
      // La corrida queda atribuida a la tienda que la lanzó.
      ...siteDefaults(await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE),
      name: input.name,
      status: 'draft',
      kind: 'enrichment',
      created_by: actorId,
      selection_definition: input.selection_definition ?? null,
      selection_count: productIds.length,
    },
  ]);
  if (!execution) throw new Error('No se pudo crear la ejecución');

  await service.createCatalogingExecutionProducts(
    productIds.map((product_id) => ({
      execution_id: execution.id,
      product_id,
      status: 'pending' as const,
    }))
  );

  await service.createCatalogingOperations(
    input.operations.map((op) => ({
      execution_id: execution.id,
      type: op.type,
      field: op.field,
      configuration: op.configuration ?? null,
      status: 'pending' as const,
    }))
  );

  await service.logActivity({
    execution_id: execution.id,
    type: 'created',
    actor_id: actorId,
    metadata: { product_count: productIds.length, operations: input.operations.length },
  });

  await service.recomputeProgress(execution.id);

  res.status(201).json({ execution });
}
