import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { CATALOGADOR_MODULE } from '../../../../../../../modules/catalogador';
import type CatalogadorModuleService from '../../../../../../../modules/catalogador/service';
import { cleanupProposalFiles } from '../../../../../../../modules/catalogador/asset-cleanup';
import type { ExecutionProductStatus, ExecutionStatus } from '../../../../../../../modules/catalogador/models';
import { getCatalogadorConfig } from '../../../../../../../modules/catalogador/config';
import { planAcceptAll, rawValue } from './lib';

import { siteFromRequest } from '../../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../../lib/multistore/scope';
import { CATALOGING_EXECUTION_SITE_SCOPE } from '../../../../../../../modules/catalogador/site-scope';

export const ReviewProductSchema = z.object({
  action: z.enum(['accept_all', 'reject_all', 'exclude', 'include', 'field']),
  /** Requerido para action='field'. */
  field: z.string().optional(),
  decision: z.enum(['accept', 'reject', 'edit', 'keep']).optional(),
  /** Nuevo valor para decision='edit'. */
  value: z.unknown().optional(),
});

type ReviewInput = z.infer<typeof ReviewProductSchema>;
type FieldMap = Record<string, unknown>;

/**
 * POST /admin/catalogador/executions/:id/products/:pid
 *
 * Acciones de revisión por producto/campo (PRD §15.3/§15.4). No aplica cambios
 * al catálogo: sólo registra las DECISIONES del usuario sobre las propuestas.
 * La aplicación real la hace /apply (PRD §18.2).
 */
export async function POST(req: MedusaRequest<ReviewInput>, res: MedusaResponse): Promise<void> {
  // El guard va sobre la EJECUCIÓN y no sobre `:pid`: `cataloging_execution_product`
  // no tiene columna de tienda propia, la hereda de la corrida. La pertenencia del
  // hijo al padre ya la valida el `product.execution_id !== executionId` de abajo,
  // así que las dos mitades juntas cierran el caso: el padre es mío y el hijo es de
  // ese padre.
  await assertIdInSite(req.scope, await siteFromRequest(req), CATALOGING_EXECUTION_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);
  const executionId = req.params.id as string;
  const pid = req.params.pid as string;
  const body = req.validatedBody as ReviewInput;
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  let product;
  try {
    product = await service.retrieveCatalogingExecutionProduct(pid);
  } catch {
    res.status(404).json({ type: 'not_found', message: 'Producto de la ejecución no encontrado' });
    return;
  }
  if (product.execution_id !== executionId) {
    res.status(404).json({ type: 'not_found', message: 'Producto no pertenece a la ejecución' });
    return;
  }

  const proposed = (product.proposed_changes ?? {}) as FieldMap;
  const accepted = { ...((product.accepted_changes ?? {}) as FieldMap) };
  const rejected = { ...((product.rejected_changes ?? {}) as FieldMap) };
  let status = product.status as ExecutionProductStatus;
  let activityType = 'reviewed';

  // Gating por confianza (PRD §13/§22.5): con `require_review_low_confidence`,
  // los campos por debajo del umbral NO se auto-aceptan en "aceptar todo" y
  // quedan pendientes de una decisión explícita por campo. La confianza vive en
  // `proposed_changes[field].confidence` (el valor crudo se sigue descartando al
  // escribir en accepted_changes).
  const config = await getCatalogadorConfig(req.scope).catch(() => null);
  const requireReview = Boolean(config?.rules.require_review_low_confidence);
  // El `??` sólo entra si la lectura de config TIRÓ (el `.catch(() => null)` de
  // arriba). Tiene que ser el mismo número que el default de `config.ts`: con
  // 0.7 contra un techo alcanzable de 0.7 la comparación estricta difiere el
  // 100% de los campos, así que un fallback desalineado convertiría un fallo de
  // lectura en un "aceptar todo" que no acepta nada.
  const threshold = config?.rules.low_confidence_threshold ?? 0.5;
  const deferredLowConfidence: Array<{ field: string; confidence: number }> = [];

  // Decisiones de TEXTO.
  switch (body.action) {
    case 'accept_all': {
      // Un campo con decisión explícita se saltea entero y NO cuenta como
      // diferido: ver `planAcceptAll` en ./lib para por qué importa.
      const plan = planAcceptAll({ proposed, accepted, rejected, requireReview, threshold });
      Object.assign(accepted, plan.accept);
      for (const field of plan.unreject) delete rejected[field];
      deferredLowConfidence.push(...plan.deferred);
      break;
    }
    case 'reject_all':
      for (const field of Object.keys(proposed)) {
        rejected[field] = proposed[field];
        delete accepted[field];
      }
      break;
    case 'exclude':
    case 'include':
      break;
    case 'field': {
      if (!body.field) {
        res.status(400).json({ type: 'invalid_data', message: 'Falta "field".' });
        return;
      }
      const field = body.field;
      if (body.decision === 'accept') {
        accepted[field] = rawValue(proposed[field]);
        delete rejected[field];
      } else if (body.decision === 'edit') {
        accepted[field] = body.value;
        delete rejected[field];
        activityType = 'edited';
      } else if (body.decision === 'reject' || body.decision === 'keep') {
        rejected[field] = proposed[field];
        delete accepted[field];
      }
      break;
    }
  }

  // Decisiones de IMÁGENES en acciones masivas: "aceptar todo" también elige
  // imágenes (una por tipo de operación; el resto se descarta), para que al
  // aplicar se adjunten. "rechazar todo"/"excluir" descartan todas.
  if (body.action === 'accept_all' || body.action === 'reject_all' || body.action === 'exclude') {
    const assetProps = await service.listCatalogingAssetProposals(
      { execution_product_id: pid },
      { take: null as unknown as number }
    );
    const pending = assetProps.filter((a) => a.status !== 'applied');
    if (body.action === 'accept_all') {
      // Técnicas (optimize, is_ai_generated=false): se aceptan TODAS (cada una
      // reemplaza una imagen distinta). IA: una por tipo de operación (las demás
      // variaciones son alternativas → se descartan).
      const seenAiOps = new Set<string>();
      // Producto sin imagen: la importada real (import_external) y su recreación
      // IA (generate_missing) son EXCLUYENTES. En bulk se prefiere la imagen real
      // y se descarta la recreación (el usuario puede elegir la IA por producto).
      const hasImport = pending.some((a) => a.operation_type === 'import_external');
      const acc: string[] = [];
      const rej: string[] = [];
      for (const a of pending) {
        if (a.operation_type === 'import_external') {
          acc.push(a.id);
          continue;
        }
        if (!a.is_ai_generated) {
          acc.push(a.id);
          continue;
        }
        if (hasImport && a.operation_type === 'generate_missing') {
          rej.push(a.id);
          continue;
        }
        if (!seenAiOps.has(a.operation_type)) {
          seenAiOps.add(a.operation_type);
          acc.push(a.id);
        } else {
          rej.push(a.id);
        }
      }
      if (acc.length) await service.updateCatalogingAssetProposals(acc.map((aid) => ({ id: aid, status: 'accepted' as const })));
      if (rej.length) {
        await service.updateCatalogingAssetProposals(rej.map((aid) => ({ id: aid, status: 'rejected' as const })));
        // Lo descartado por "aceptar todo" (variaciones sobrantes de la misma
        // operación) se borra. `keepUrls` protege las que quedaron aceptadas.
        const rejected = pending.filter((a) => rej.includes(a.id));
        const keepUrls = pending
          .filter((a) => acc.includes(a.id))
          .map((a) => a.generated_asset_id)
          .filter((u): u is string => Boolean(u));
        await cleanupProposalFiles(req.scope, rejected, { mode: 'discard', keepUrls });
      }
    } else {
      const toReject = pending.filter((a) => a.status !== 'rejected');
      if (toReject.length) {
        await service.updateCatalogingAssetProposals(toReject.map((a) => ({ id: a.id, status: 'rejected' as const })));
        await cleanupProposalFiles(req.scope, toReject, { mode: 'discard' });
      }
    }
  }

  // Estado final (considera texto Y imágenes aceptadas).
  if (body.action === 'exclude') {
    status = 'excluded';
  } else if (body.action === 'reject_all') {
    status = 'rejected';
  } else if (body.action === 'include') {
    status = Object.keys(proposed).length ? 'proposed' : 'pending';
  } else {
    const acceptedAssets = await service.listCatalogingAssetProposals(
      { execution_product_id: pid, status: 'accepted' },
      { take: 1 }
    );
    const hasAny = Object.keys(accepted).length > 0 || acceptedAssets.length > 0;
    if (hasAny) status = 'accepted';
    // Si "aceptar todo" difirió campos por baja confianza, el producto sigue
    // requiriendo revisión: queda 'proposed', no 'no_changes'.
    else if (deferredLowConfidence.length > 0) status = 'proposed';
    else status = body.action === 'accept_all' ? 'no_changes' : 'proposed';
  }

  const [updated] = await service.updateCatalogingExecutionProducts([
    { id: pid, status, accepted_changes: accepted, rejected_changes: rejected },
  ]);

  await service.logActivity({
    execution_id: executionId,
    execution_product_id: pid,
    type: activityType,
    actor_id: actorId,
    metadata: {
      action: body.action,
      field: body.field ?? null,
      decision: body.decision ?? null,
      // Los campos diferidos van también al timeline: si el usuario vuelve a
      // preguntar "por qué no se aceptó nada", la traza ya lo explica.
      ...(deferredLowConfidence.length
        ? {
            deferred_low_confidence: deferredLowConfidence.length,
            deferred_low_confidence_fields: deferredLowConfidence,
            low_confidence_threshold: threshold,
          }
        : {}),
    },
  });

  // Recalcula progreso y ajusta el estado de la ejecución (parcialmente
  // revisada / lista para aplicar) sin forzar (PRD §8).
  await service.recomputeProgress(executionId);
  await maybeAdvanceExecution(service, executionId);

  // El gate de baja confianza difería campos sin dejar rastro en la respuesta:
  // el "aceptar todo" volvía 200 con `accepted_changes` vacío y desde la UI se
  // veía como si el botón no hiciera nada. Se devuelve `null` cuando no hubo
  // diferidos para que el consumidor pueda chequear presencia sin ambigüedad.
  res.status(200).json({
    product: updated,
    deferred_low_confidence: deferredLowConfidence.length
      ? { count: deferredLowConfidence.length, fields: deferredLowConfidence, threshold }
      : null,
  });
}

/** Ajusta el estado de la ejecución según cuántos productos quedan por revisar. */
async function maybeAdvanceExecution(
  service: CatalogadorModuleService,
  executionId: string
): Promise<void> {
  const execution = await service.retrieveCatalogingExecution(executionId);
  if (!['pending_review', 'partially_reviewed', 'ready_to_apply'].includes(execution.status as string)) {
    return;
  }
  const products = await service.listCatalogingExecutionProducts(
    { execution_id: executionId },
    { take: null as unknown as number }
  );
  const reviewable = products.filter((p) => !['excluded', 'applied'].includes(p.status as string));
  const pendingReview = reviewable.filter((p) => ['proposed', 'generating', 'pending'].includes(p.status as string));

  let next = execution.status as ExecutionStatus;
  if (pendingReview.length === 0 && reviewable.length > 0) next = 'ready_to_apply';
  else if (pendingReview.length < reviewable.length) next = 'partially_reviewed';
  else next = 'pending_review';

  if (next !== execution.status) {
    await service.updateCatalogingExecutions([{ id: executionId, status: next }]);
  }
}
