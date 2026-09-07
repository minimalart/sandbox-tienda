"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogingExecution = exports.EXECUTION_KINDS = exports.EXECUTION_STATUSES = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Estados funcionales de una ejecución (PRD §8). La transición la controla el
 * service; la UI y los workflows sólo leen/escriben estados válidos.
 */
exports.EXECUTION_STATUSES = [
    'draft', // borrador: selección/config sin enviar a procesar (o revisión parcial)
    'generating', // obteniendo/generando propuestas
    'pending_review', // generación terminada, hay resultados para validar
    'partially_reviewed', // parte revisada, quedan propuestas pendientes
    'ready_to_apply', // todo revisado o decisión explícita de aplicar por lote
    'applying', // actualizando productos en Medusa
    'applied', // cambios aplicados correctamente
    'partially_applied', // una parte aplicada, otra falló
    'error', // no pudo completar generación o aplicación
    'cancelled', // cancelada antes de aplicar
    'restored', // sus cambios fueron revertidos por una restauración
];
/** Tipo de ejecución: normal (enriquecimiento) o restauración de otra. */
exports.EXECUTION_KINDS = ['enrichment', 'restoration'];
/**
 * CatalogingExecution — un proceso completo de enriquecimiento (PRD §7). Guarda
 * la selección exacta de productos, la config efectiva (con prompts congelados),
 * el avance y el resumen. Los cambios propuestos/aceptados viven en los productos
 * de la ejecución (cataloging_execution_product).
 */
exports.CatalogingExecution = utils_1.model
    .define('cataloging_execution', {
    id: utils_1.model.id({ prefix: 'catexec' }).primaryKey(),
    name: utils_1.model.text(),
    status: utils_1.model.enum([...exports.EXECUTION_STATUSES]).default('draft'),
    kind: utils_1.model.enum([...exports.EXECUTION_KINDS]).default('enrichment'),
    created_by: utils_1.model.text().nullable(),
    /**
     * La tienda desde la que se lanzó la corrida. `NULL` = anterior a la columna.
     *
     * OJO con lo que esto NO significa: el producto que la corrida enriquece es
     * COMPARTIDO por toda la instancia. Esto scopea el HISTORIAL —quién corrió qué y
     * cuándo—, que es lo que el operador de una tienda necesita ver sin el ruido de
     * las demás. El efecto sigue siendo global, y el listado lo dice.
     */
    site_id: utils_1.model.text().nullable(),
    // Ciclo de vida
    generation_started_at: utils_1.model.dateTime().nullable(),
    generation_completed_at: utils_1.model.dateTime().nullable(),
    apply_started_at: utils_1.model.dateTime().nullable(),
    applied_at: utils_1.model.dateTime().nullable(),
    cancelled_at: utils_1.model.dateTime().nullable(),
    // Trazabilidad de origen (reflotar / restaurar)
    restored_from_execution_id: utils_1.model.text().nullable(),
    duplicated_from_execution_id: utils_1.model.text().nullable(),
    // Config efectiva usada + versión de prompts congelada (PRD §14.1)
    configuration_snapshot: utils_1.model.json().nullable(),
    // Definición de la selección (filtros aplicados) — NO se re-ejecuta al
    // retomar salvo pedido explícito (PRD §11.5). Los IDs exactos van aparte.
    selection_definition: utils_1.model.json().nullable(),
    selection_count: utils_1.model.number().default(0),
    // Costo de IA agregado de la ejecución (suma de sus productos). `ai_cost_usd`
    // es columna propia para poder ordenar/sumar por SQL; `ai_usage` guarda el
    // desglose (texto vs imagen, tokens, llamadas por modelo).
    ai_cost_usd: utils_1.model.float().default(0),
    ai_usage: utils_1.model.json().nullable(),
    // Agregados de avance/resultado/errores (json)
    progress: utils_1.model.json().nullable(),
    summary: utils_1.model.json().nullable(),
    error_summary: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['status'], where: 'deleted_at IS NULL' },
    { on: ['created_by'], where: 'deleted_at IS NULL' },
    { on: ['site_id'], where: 'deleted_at IS NULL' },
]);
exports.default = exports.CatalogingExecution;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZ2luZy1leGVjdXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jYXRhbG9nYWRvci9tb2RlbHMvY2F0YWxvZ2luZy1leGVjdXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7R0FHRztBQUNVLFFBQUEsa0JBQWtCLEdBQUc7SUFDaEMsT0FBTyxFQUFFLHdFQUF3RTtJQUNqRixZQUFZLEVBQUUsa0NBQWtDO0lBQ2hELGdCQUFnQixFQUFFLG9EQUFvRDtJQUN0RSxvQkFBb0IsRUFBRSwrQ0FBK0M7SUFDckUsZ0JBQWdCLEVBQUUseURBQXlEO0lBQzNFLFVBQVUsRUFBRSxtQ0FBbUM7SUFDL0MsU0FBUyxFQUFFLGtDQUFrQztJQUM3QyxtQkFBbUIsRUFBRSxpQ0FBaUM7SUFDdEQsT0FBTyxFQUFFLDRDQUE0QztJQUNyRCxXQUFXLEVBQUUsNkJBQTZCO0lBQzFDLFVBQVUsRUFBRSxxREFBcUQ7Q0FDekQsQ0FBQztBQUlYLDBFQUEwRTtBQUM3RCxRQUFBLGVBQWUsR0FBRyxDQUFDLFlBQVksRUFBRSxhQUFhLENBQVUsQ0FBQztBQUV0RTs7Ozs7R0FLRztBQUNVLFFBQUEsbUJBQW1CLEdBQUcsYUFBSztLQUNyQyxNQUFNLENBQUMsc0JBQXNCLEVBQUU7SUFDOUIsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDaEQsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDbEIsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLDBCQUFrQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQzVELElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyx1QkFBZSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO0lBQzVELFVBQVUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ25DOzs7Ozs7O09BT0c7SUFDSCxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUVoQyxnQkFBZ0I7SUFDaEIscUJBQXFCLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsRCx1QkFBdUIsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BELGdCQUFnQixFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0MsVUFBVSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdkMsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFFekMsZ0RBQWdEO0lBQ2hELDBCQUEwQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbkQsNEJBQTRCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUVyRCxtRUFBbUU7SUFDbkUsc0JBQXNCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMvQyx1RUFBdUU7SUFDdkUsMEVBQTBFO0lBQzFFLG9CQUFvQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0MsZUFBZSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBRTFDLDhFQUE4RTtJQUM5RSwyRUFBMkU7SUFDM0UsMkRBQTJEO0lBQzNELFdBQVcsRUFBRSxhQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUVqQywrQ0FBK0M7SUFDL0MsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsT0FBTyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDaEMsYUFBYSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDdkMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0lBQy9DLEVBQUUsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0lBQ25ELEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0NBQ2pELENBQUMsQ0FBQztBQUVMLGtCQUFlLDJCQUFtQixDQUFDIn0=