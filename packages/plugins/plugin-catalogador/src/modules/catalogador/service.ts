import { MedusaService } from '@medusajs/framework/utils';
import { emptyAiUsage, mergeAiUsage, type AiUsageBreakdown } from './ai/openrouter';
import { isDeletableStatus } from './deletable';
import {
  CatalogingActivity,
  CatalogingAssetProposal,
  CatalogingExecution,
  CatalogingExecutionProduct,
  CatalogingOperation,
  CatalogingSnapshot,
  type ExecutionStatus,
  type OperationStatus,
} from './models';


/** Progreso agregado que la lista/detalle muestran (PRD §14.2). */
export type ExecutionProgress = {
  total: number;
  processed: number;
  proposed: number;
  no_changes: number;
  warnings: number;
  failed: number;
  percent: number;
};

class CatalogadorModuleService extends MedusaService({
  CatalogingExecution,
  CatalogingExecutionProduct,
  CatalogingOperation,
  CatalogingAssetProposal,
  CatalogingSnapshot,
  CatalogingActivity,
}) {
  /**
   * ¿La ejecución puede mandarse a la papelera? La regla y el porqué de cada
   * estado viven en `deletable.ts`, que es puro y tiene tests.
   */
  isDeletable(status: ExecutionStatus): boolean {
    return isDeletableStatus(status);
  }

  /**
   * Registra un evento de auditoría (append-only). Best-effort: nunca rompe el
   * flujo llamador (PRD §32).
   */
  async logActivity(input: {
    execution_id: string;
    type: string;
    execution_product_id?: string | null;
    actor_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.createCatalogingActivities({
        execution_id: input.execution_id,
        type: input.type,
        execution_product_id: input.execution_product_id ?? null,
        actor_id: input.actor_id ?? null,
        metadata: input.metadata ?? null,
      });
    } catch {
      // auditoría best-effort
    }
  }

  /**
   * Recalcula el progreso de una ejecución a partir del estado de sus productos
   * y lo persiste en `progress`. Devuelve el agregado.
   *
   * Aprovecha el mismo listado para reagregar el costo de IA de la ejecución
   * (suma de sus productos): así el total nunca se desincroniza, sin importar
   * qué camino generó/regeneró propuestas.
   */
  async recomputeProgress(executionId: string): Promise<ExecutionProgress> {
    const products = await this.listCatalogingExecutionProducts(
      { execution_id: executionId },
      { take: null as unknown as number }
    );

    const total = products.length;
    const processed = products.filter((p) =>
      ['proposed', 'no_changes', 'accepted', 'rejected', 'excluded', 'applied', 'apply_failed', 'error'].includes(
        p.status as string
      )
    ).length;
    const proposed = products.filter((p) => p.status === 'proposed').length;
    const no_changes = products.filter((p) => p.status === 'no_changes').length;
    const failed = products.filter((p) => ['error', 'apply_failed'].includes(p.status as string)).length;
    const warnings = products.filter(
      (p) => Array.isArray(p.warnings) && (p.warnings as unknown[]).length > 0
    ).length;
    const percent = total === 0 ? 0 : Math.round((processed / total) * 100);

    const progress: ExecutionProgress = {
      total,
      processed,
      proposed,
      no_changes,
      warnings,
      failed,
      percent,
    };

    let aiUsage = emptyAiUsage();
    for (const p of products) {
      aiUsage = mergeAiUsage(aiUsage, (p.ai_usage as AiUsageBreakdown | null) ?? null);
    }

    await this.updateCatalogingExecutions({
      id: executionId,
      progress,
      ai_cost_usd: aiUsage.total_usd,
      ai_usage: aiUsage.calls > 0 ? aiUsage : null,
    });
    return progress;
  }

  /**
   * Mueve TODAS las operaciones de una corrida a un estado.
   *
   * `cataloging_operation.status` nacía en `pending` por el default del modelo y
   * `updateCatalogingOperations` —que `MedusaService` genera— no se llamaba en
   * ningún lado del repo: la columna era decorativa y decía `pending` para
   * siempre, incluso con la generación al 100% y los 40 productos procesados sin
   * un error. No era una transición mal hecha; la transición no estaba escrita.
   *
   * Best-effort a propósito, igual que `logActivity`: es metadata de progreso, y
   * no vale tirar una generación o un apply que sí funcionaron porque no se pudo
   * estampar el estado de la operación.
   */
  async setOperationsStatus(executionId: string, status: OperationStatus): Promise<void> {
    try {
      const operations = await this.listCatalogingOperations(
        { execution_id: executionId },
        { take: null as unknown as number }
      );
      if (!operations.length) return;
      await this.updateCatalogingOperations(
        operations.map((operation) => ({ id: operation.id, status }))
      );
    } catch {
      // Silencioso por diseño: ver el comentario de arriba.
    }
  }

  /**
   * Transición de estado con timestamps de ciclo de vida (PRD §7/§8). No valida
   * el grafo de transiciones (lo hacen los endpoints/workflows); centraliza el
   * estampado de fechas.
   */
  async setStatus(executionId: string, status: ExecutionStatus): Promise<void> {
    const now = new Date();
    const patch: Record<string, unknown> = { id: executionId, status };
    switch (status) {
      case 'generating':
        patch.generation_started_at = now;
        break;
      case 'pending_review':
        patch.generation_completed_at = now;
        break;
      case 'applying':
        patch.apply_started_at = now;
        break;
      case 'applied':
      case 'partially_applied':
        patch.applied_at = now;
        break;
      case 'cancelled':
        patch.cancelled_at = now;
        break;
    }
    await this.updateCatalogingExecutions(patch);
  }
}

export default CatalogadorModuleService;
