import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { CATALOGADOR_MODULE } from '../modules/catalogador';
import type CatalogadorModuleService from '../modules/catalogador/service';
import { getCatalogadorConfig, mergeCatalogadorConfig, type CatalogadorConfig } from '../modules/catalogador/config';
import {
  createAiUsageScope,
  isAiConfigured,
  mergeAiUsage,
  type AiUsageBreakdown,
} from '../modules/catalogador/ai/openrouter';
import { generateForProduct, loadTaxonomy } from '../modules/catalogador/ai/enrichment';
import { TEXT_FIELDS, type TextField } from '../modules/catalogador/ai/prompts';
import { processImagesForProduct } from '../modules/catalogador/ai/image-pipeline';
import { applyExecution } from '../workflows/catalogador/apply-execution';

/**
 * Job de procesamiento del Catalogador (PRD §14.1, §18.3): drena en segundo
 * plano las ejecuciones en `generating` (genera propuestas por producto) y en
 * `applying` (aplica cambios revisados). Tolera fallas por producto (éxito
 * parcial, PRD §32) y procesa en lotes acotados por tick para no colgar el loop.
 */
export const config = {
  name: 'catalogador-process',
  schedule: process.env.CATALOGADOR_JOB_SCHEDULE || '*/1 * * * *',
};

export default async function catalogadorProcessJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<CatalogadorModuleService>(CATALOGADOR_MODULE);

  await drainGenerating(container, service, logger);
  await drainApplying(container, service, logger);
}

async function drainGenerating(
  container: MedusaContainer,
  service: CatalogadorModuleService,
  logger: Logger
): Promise<void> {
  if (!isAiConfigured()) return;

  const generating = await service.listCatalogingExecutions({ status: 'generating' }, { take: 5 });
  for (const execution of generating) {
   try {
    const cfg = resolveFrozenConfig(execution.configuration_snapshot);
    // Fallback SIN snapshot congelado (ejecuciones creadas antes de que se guardara,
    // o con el snapshot corrupto): tiene que leer la config DE LA TIENDA de la
    // ejecución, no la de la instancia. `admin/catalogador/config` es `scoped` y
    // `cataloging_execution.site_id` existe (`CATALOGING_EXECUTION_SITE_SCOPE`), así
    // que sin pasarlo el operador de la tienda B elegía modelo, prompts y límites en
    // su pantalla y el job enriquecía sus productos con los de la instancia. Igual que
    // en `admin/banners/ai-*`: no falla, sale otro texto. `readSetting` cae sola a la
    // fila global si la tienda no guardó la suya, así que una ejecución vieja con
    // `site_id` null se comporta exactamente como antes.
    const config = cfg ?? (await getCatalogadorConfig(container, execution.site_id ?? null));

    const fields = await resolveTextFields(service, execution.id);
    // Se re-toman también los que quedaron en 'generating' de un tick previo que
    // se cortó a la mitad (si no, quedarían huérfanos y la ejecución "trabada").
    const pending = await service.listCatalogingExecutionProducts(
      { execution_id: execution.id, status: ['pending', 'generating'] },
      { take: config.limits.max_concurrent_generations || 4, order: { created_at: 'ASC' } }
    );

    if (pending.length === 0) {
      await service.setStatus(execution.id, 'pending_review');
      await service.setOperationsStatus(execution.id, 'done');
      await service.recomputeProgress(execution.id);
      await service.logActivity({ execution_id: execution.id, type: 'generation_completed' });
      continue;
    }

    // Operaciones de imagen elegidas (técnicas + IA).
    const imageOps = await resolveImageOps(service, execution.id);

    // Cargar taxonomía una vez por tick. Es NO fatal: si falla (p.ej. la query
    // de categorías), se sigue con taxonomía vacía y las categorías/tags quedan
    // sin resolver (con warning), en vez de dejar la ejecución trabada.
    let taxonomy = { categories: [], tags: [], categoryByNormalizedName: new Map(), tagByNormalizedValue: new Map() } as Awaited<ReturnType<typeof loadTaxonomy>>;
    if (fields.some((f) => f === 'categories' || f === 'tags')) {
      try {
        taxonomy = await loadTaxonomy(container);
      } catch (e) {
        logger.warn(`[catalogador] loadTaxonomy falló (${e instanceof Error ? e.message : e}); sigo sin taxonomía.`);
      }
    }

    await service.updateCatalogingExecutionProducts(
      pending.map((p) => ({ id: p.id, status: 'generating' as const }))
    );

    for (const p of pending) {
      // Ámbito de medición del costo IA de ESTE producto: cubre las llamadas de
      // texto y de imágenes a cualquier profundidad. Se acumula sobre lo que ya
      // tenía (cada reintento/regeneración se cobra aparte).
      const costScope = createAiUsageScope();
      const costPatch = (): { ai_cost_usd: number; ai_usage: AiUsageBreakdown } => {
        const merged = mergeAiUsage((p.ai_usage as AiUsageBreakdown | null) ?? null, costScope.usage);
        return { ai_cost_usd: merged.total_usd, ai_usage: merged };
      };
      try {
        const warnings: string[] = [];
        let proposedCount = 0;
        // Imágenes reales encontradas en la web durante el paso de texto: se
        // reutilizan en el paso de imágenes para no repetir la búsqueda web.
        let imageCandidates: string[] | undefined;
        const patch: Record<string, unknown> = {
          id: p.id,
          generation_attempts: (p.generation_attempts ?? 0) + 1,
          errors: null,
        };

        // 1) Enriquecimiento textual (si hay campos de texto).
        if (fields.length) {
          const result = await costScope.run(() =>
            generateForProduct({
              container,
              productId: p.product_id,
              fields,
              config,
              taxonomy,
              attempt: (p.generation_attempts ?? 0) + 1,
            })
          );
          proposedCount += Object.keys(result.proposed_changes).length;
          warnings.push(...result.warnings);
          patch.proposed_changes = result.proposed_changes;
          patch.current_snapshot = result.current_snapshot;
          patch.product_version_reference = result.product_version_reference;
          patch.external_context_summary = result.external_context_summary;
          imageCandidates = result.external_image_candidates;
        }

        // 2) Imágenes (técnicas + IA) → crean asset proposals.
        if (imageOps.length) {
          const imgRes = await costScope.run(() =>
            processImagesForProduct({
              container,
              executionId: execution.id,
              executionProductId: p.id,
              productId: p.product_id,
              config,
              operations: imageOps,
              externalImageCandidates: imageCandidates,
            })
          );
          proposedCount += imgRes.created;
          warnings.push(...imgRes.warnings);
        }

        patch.status = proposedCount > 0 ? 'proposed' : 'no_changes';
        patch.warnings = (warnings.length ? warnings : null) as unknown as Record<string, unknown> | null;
        Object.assign(patch, costPatch());
        await service.updateCatalogingExecutionProducts([patch as never]);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.warn(`[catalogador] generación falló producto ${p.product_id}: ${message}`);
        await service.updateCatalogingExecutionProducts([
          {
            id: p.id,
            status: 'error',
            errors: [message] as unknown as Record<string, unknown>,
            generation_attempts: (p.generation_attempts ?? 0) + 1,
            // Lo consumido antes del error ya se cobró: se persiste igual.
            ...costPatch(),
          },
        ]);
      }
    }

    await service.recomputeProgress(execution.id);

    // ¿Quedan pendientes/en curso? Si no, cerrar generación.
    const stillPending = await service.listCatalogingExecutionProducts(
      { execution_id: execution.id, status: ['pending', 'generating'] },
      { take: 1 }
    );
    if (stillPending.length === 0) {
      await service.setStatus(execution.id, 'pending_review');
      await service.setOperationsStatus(execution.id, 'done');
      await service.logActivity({ execution_id: execution.id, type: 'generation_completed' });
    }
   } catch (e) {
      // Falla a nivel ejecución (antes del loop por producto): se marca la
      // ejecución como 'error' con el detalle, en vez de reintentar en silencio
      // cada minuto y quedar "trabada" en generating.
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`[catalogador] ejecución ${execution.id} falló al generar: ${message}`);
      await service
        .updateCatalogingExecutions([{ id: execution.id, status: 'error', error_summary: { message } }])
        .catch(() => undefined);
      await service.logActivity({ execution_id: execution.id, type: 'error', metadata: { phase: 'generate', message } });
      // La corrida murió: las operaciones no se quedan diciendo `running`.
      await service.setOperationsStatus(execution.id, 'error');
    }
  }
}

async function drainApplying(
  container: MedusaContainer,
  service: CatalogadorModuleService,
  logger: Logger
): Promise<void> {
  const applying = await service.listCatalogingExecutions({ status: 'applying' }, { take: 3 });
  for (const execution of applying) {
    try {
      await applyExecution(container, execution.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`[catalogador] aplicación falló ejecución ${execution.id}: ${message}`);
      await service.updateCatalogingExecutions([
        { id: execution.id, status: 'error', error_summary: { message } },
      ]);
    }
  }
}

function resolveFrozenConfig(snapshot: unknown): CatalogadorConfig | null {
  if (snapshot && typeof snapshot === 'object' && 'config' in (snapshot as Record<string, unknown>)) {
    return mergeCatalogadorConfig((snapshot as { config: unknown }).config);
  }
  return null;
}

/** Deriva los campos de texto elegidos a partir de las operaciones de la ejecución. */
async function resolveTextFields(
  service: CatalogadorModuleService,
  executionId: string
): Promise<TextField[]> {
  const ops = await service.listCatalogingOperations({ execution_id: executionId, type: 'text_field' });
  const fields = ops.map((o) => o.field).filter((f): f is TextField => (TEXT_FIELDS as readonly string[]).includes(f));
  return [...new Set(fields)];
}

/** Operaciones de imagen (técnicas + IA) de la ejecución. */
async function resolveImageOps(
  service: CatalogadorModuleService,
  executionId: string
): Promise<Array<{ type: string; field: string }>> {
  const ops = await service.listCatalogingOperations({ execution_id: executionId });
  return ops
    .filter((o) => o.type === 'image_technical' || o.type === 'image_ai')
    .map((o) => ({ type: o.type as string, field: o.field }));
}
