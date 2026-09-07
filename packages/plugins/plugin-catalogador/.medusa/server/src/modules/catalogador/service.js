"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const openrouter_1 = require("./ai/openrouter");
const models_1 = require("./models");
/**
 * Estados desde los que se puede eliminar (sólo borradores; una ejecución
 * aplicada nunca se elimina — PRD §9.5).
 */
const DELETABLE_STATUSES = ['draft', 'cancelled', 'error'];
class CatalogadorModuleService extends (0, utils_1.MedusaService)({
    CatalogingExecution: models_1.CatalogingExecution,
    CatalogingExecutionProduct: models_1.CatalogingExecutionProduct,
    CatalogingOperation: models_1.CatalogingOperation,
    CatalogingAssetProposal: models_1.CatalogingAssetProposal,
    CatalogingSnapshot: models_1.CatalogingSnapshot,
    CatalogingActivity: models_1.CatalogingActivity,
}) {
    /** ¿La ejecución puede eliminarse? (sólo borradores/canceladas/error) */
    isDeletable(status) {
        return DELETABLE_STATUSES.includes(status);
    }
    /**
     * Registra un evento de auditoría (append-only). Best-effort: nunca rompe el
     * flujo llamador (PRD §32).
     */
    async logActivity(input) {
        try {
            await this.createCatalogingActivities({
                execution_id: input.execution_id,
                type: input.type,
                execution_product_id: input.execution_product_id ?? null,
                actor_id: input.actor_id ?? null,
                metadata: input.metadata ?? null,
            });
        }
        catch {
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
    async recomputeProgress(executionId) {
        const products = await this.listCatalogingExecutionProducts({ execution_id: executionId }, { take: null });
        const total = products.length;
        const processed = products.filter((p) => ['proposed', 'no_changes', 'accepted', 'rejected', 'excluded', 'applied', 'apply_failed', 'error'].includes(p.status)).length;
        const proposed = products.filter((p) => p.status === 'proposed').length;
        const no_changes = products.filter((p) => p.status === 'no_changes').length;
        const failed = products.filter((p) => ['error', 'apply_failed'].includes(p.status)).length;
        const warnings = products.filter((p) => Array.isArray(p.warnings) && p.warnings.length > 0).length;
        const percent = total === 0 ? 0 : Math.round((processed / total) * 100);
        const progress = {
            total,
            processed,
            proposed,
            no_changes,
            warnings,
            failed,
            percent,
        };
        let aiUsage = (0, openrouter_1.emptyAiUsage)();
        for (const p of products) {
            aiUsage = (0, openrouter_1.mergeAiUsage)(aiUsage, p.ai_usage ?? null);
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
    async setOperationsStatus(executionId, status) {
        try {
            const operations = await this.listCatalogingOperations({ execution_id: executionId }, { take: null });
            if (!operations.length)
                return;
            await this.updateCatalogingOperations(operations.map((operation) => ({ id: operation.id, status })));
        }
        catch {
            // Silencioso por diseño: ver el comentario de arriba.
        }
    }
    /**
     * Transición de estado con timestamps de ciclo de vida (PRD §7/§8). No valida
     * el grafo de transiciones (lo hacen los endpoints/workflows); centraliza el
     * estampado de fechas.
     */
    async setStatus(executionId, status) {
        const now = new Date();
        const patch = { id: executionId, status };
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
exports.default = CatalogadorModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBMEQ7QUFDMUQsZ0RBQW9GO0FBQ3BGLHFDQVNrQjtBQUVsQjs7O0dBR0c7QUFDSCxNQUFNLGtCQUFrQixHQUFzQixDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFhOUUsTUFBTSx3QkFBeUIsU0FBUSxJQUFBLHFCQUFhLEVBQUM7SUFDbkQsbUJBQW1CLEVBQW5CLDRCQUFtQjtJQUNuQiwwQkFBMEIsRUFBMUIsbUNBQTBCO0lBQzFCLG1CQUFtQixFQUFuQiw0QkFBbUI7SUFDbkIsdUJBQXVCLEVBQXZCLGdDQUF1QjtJQUN2QixrQkFBa0IsRUFBbEIsMkJBQWtCO0lBQ2xCLGtCQUFrQixFQUFsQiwyQkFBa0I7Q0FDbkIsQ0FBQztJQUNBLHlFQUF5RTtJQUN6RSxXQUFXLENBQUMsTUFBdUI7UUFDakMsT0FBTyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsS0FNakI7UUFDQyxJQUFJLENBQUM7WUFDSCxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQztnQkFDcEMsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZO2dCQUNoQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7Z0JBQ2hCLG9CQUFvQixFQUFFLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxJQUFJO2dCQUN4RCxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsSUFBSSxJQUFJO2dCQUNoQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsSUFBSSxJQUFJO2FBQ2pDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCx3QkFBd0I7UUFDMUIsQ0FBQztJ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