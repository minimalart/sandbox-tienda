import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { CATALOGADOR_MODULE } from '../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../modules/catalogador/service';
import { getCatalogadorConfig } from '../../../../../../modules/catalogador/config';
import { isAiConfigured } from '../../../../../../modules/catalogador/ai/openrouter';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { siteOf } from '../../../_shared';
import { cleanupExecutionFiles } from '../../../../../../modules/catalogador/asset-cleanup';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../modules/catalogador/site-scope';

export const GenerateExecutionSchema = z.object({
  /** Si se pasa, sólo (re)genera estos productos (regeneración dirigida). */
  product_ids: z.array(z.string()).optional(),
  /** Regenerar sólo los fallidos. */
  only_failed: z.boolean().optional(),
});

type GenerateInput = z.infer<typeof GenerateExecutionSchema>;

/**
 * POST /admin/catalogador/executions/:id/generate
 *
 * Marca la ejecución como `generating` y congela la config efectiva usada
 * (PRD §14.1). El procesamiento real corre en segundo plano (job
 * catalogador-process) para que el usuario pueda abandonar la pantalla
 * (PRD §14.1). No genera nada de forma síncrona.
 */
export async function POST(
  req: MedusaRequest<GenerateInput>,
  res: MedusaResponse
): Promise<void> {
  // El mismo guard que el detalle, y ANTES del chequeo de config: generar sobre la
  // corrida de otra tienda le pisa el estado a `generating`, le resetea productos a
  // `pending` y le quema crédito de IA. Va primero para que un id ajeno conteste 404
  // y no un 503 que ya confirmaría que la ruta llegó a mirar la fila.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const id = req.params.id as string;
  const body = req.validatedBody as GenerateInput;
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  if (!isAiConfigured()) {
    res.status(503).json({
      type: 'not_allowed',
      message: 'OPENROUTER_API_KEY no está configurada en el backend.',
    });
    return;
  }

  let execution;
  try {
    execution = await service.retrieveCatalogingExecution(id);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Ejecución no encontrada' });
    return;
  }

  const allowed = ['draft', 'pending_review', 'partially_reviewed', 'error'];
  if (!allowed.includes(execution.status as string)) {
    res.status(409).json({
      type: 'not_allowed',
      message: `No se puede generar desde el estado "${execution.status}".`,
    });
    return;
  }

  // Congela la config efectiva usada por esta ejecución (incluye versión de
  // prompts). No se toca si ya estaba congelada por una corrida previa.
  // Con el siteId, y NO sin él: `readSetting` sin tienda va derecho a la fila
  // global, así que congelar sin site descarta lo que el operador guardó para SU
  // tienda en /config y corre la ejecución con los defaults.
  const config = await getCatalogadorConfig(req.scope, await siteOf(req));
  const configuration_snapshot =
    execution.configuration_snapshot ?? { config, frozen_at: new Date().toISOString() };

  // Marca los productos objetivo como pendientes de (re)generar.
  const targetFilter: Record<string, unknown> = { execution_id: id };
  if (body.product_ids?.length) targetFilter.product_id = body.product_ids;
  else if (body.only_failed) targetFilter.status = 'error';

  const targets = await service.listCatalogingExecutionProducts(targetFilter, {
    take: null as unknown as number,
  });
  if (targets.length) {
    const toRegenerate = targets.filter((p) => p.status !== 'excluded');
    // Limpiar ANTES de re-encolar: regenerar no reemplazaba las propuestas viejas,
    // creaba propuestas nuevas y volvía a subir el set completo de archivos. Cada
    // reintento multiplicaba el residuo, y el tablero de revisión acumulaba
    // propuestas de todas las corridas. Las ya aplicadas nunca se tocan.
    if (toRegenerate.length) {
      await cleanupExecutionFiles(req.scope, id, {
        productIds: toRegenerate.map((p) => p.id),
        deleteRows: true,
      });
    }
    await service.updateCatalogingExecutionProducts(
      toRegenerate.map((p) => ({ id: p.id, status: 'pending' as const }))
    );
  }

  await service.updateCatalogingExecutions([{ id, configuration_snapshot }]);
  await service.setStatus(id, 'generating');
  // Las operaciones acompañan el ciclo de la corrida: sin esto quedaban en
  // `pending` para siempre y el panel mentía sobre lo que había corrido.
  await service.setOperationsStatus(id, 'running');
  await service.logActivity({
    execution_id: id,
    type: 'generation_started',
    actor_id: actorId,
    metadata: { targeted: Boolean(body.product_ids?.length), only_failed: Boolean(body.only_failed) },
  });

  const execAfter = await service.retrieveCatalogingExecution(id);
  res.status(202).json({ execution: execAfter, queued: targets.length });
}
