"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogingExecutionProduct = exports.EXECUTION_PRODUCT_STATUSES = void 0;
const utils_1 = require("@medusajs/framework/utils");
/** Estado de revisión/generación de un producto dentro de la ejecución. */
exports.EXECUTION_PRODUCT_STATUSES = [
    'pending', // aún no generado
    'generating',
    'proposed', // tiene propuesta lista para revisar
    'no_changes', // el sistema no propuso cambios
    'accepted', // el usuario aceptó (total o parcialmente) — listo para aplicar
    'rejected', // el usuario rechazó todos los cambios
    'excluded', // excluido de la ejecución
    'applied',
    'apply_failed',
    'error', // falló la generación
];
/**
 * CatalogingExecutionProduct — un producto seleccionado dentro de una ejecución
 * (PRD §24). Persiste el snapshot de los valores al generar (para detectar
 * cambios concurrentes al aplicar, PRD §18.4) y las propuestas por campo.
 *
 * Relación con la ejecución vía `execution_id` (text FK, no relación MikroORM,
 * para mantener migraciones y CRUD simples).
 */
exports.CatalogingExecutionProduct = utils_1.model
    .define('cataloging_execution_product', {
    id: utils_1.model.id({ prefix: 'catexecp' }).primaryKey(),
    execution_id: utils_1.model.text(),
    product_id: utils_1.model.text(),
    status: utils_1.model.enum([...exports.EXECUTION_PRODUCT_STATUSES]).default('pending'),
    // Referencia de versión (hash/valores base) para detectar cambios
    // posteriores del catálogo antes de aplicar (PRD §17, §18.4).
    product_version_reference: utils_1.model.json().nullable(),
    // Estado de los campos afectados al momento de generar.
    current_snapshot: utils_1.model.json().nullable(),
    // Propuestas por campo: { field: { value, attempt, confidence, source_trace, warnings } }
    proposed_changes: utils_1.model.json().nullable(),
    // Decisiones del usuario (por campo).
    accepted_changes: utils_1.model.json().nullable(),
    rejected_changes: utils_1.model.json().nullable(),
    warnings: utils_1.model.json().nullable(),
    errors: utils_1.model.json().nullable(),
    // Costo de IA imputado a este producto (acumulado entre reintentos/
    // regeneraciones: cada intento se cobra). `ai_usage` guarda el desglose.
    ai_cost_usd: utils_1.model.float().default(0),
    ai_usage: utils_1.model.json().nullable(),
    // Resumen de fuentes externas usadas (catálogo/imagen/barcode/scraping/IA).
    external_context_summary: utils_1.model.json().nullable(),
    generation_attempts: utils_1.model.number().default(0),
})
    .indexes([
    { on: ['execution_id'], where: 'deleted_at IS NULL' },
    { on: ['product_id'], where: 'deleted_at IS NULL' },
    {
        on: ['execution_id', 'product_id'],
        unique: true,
        where: 'deleted_at IS NULL',
    },
]);
exports.default = exports.CatalogingExecutionProduct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZ2luZy1leGVjdXRpb24tcHJvZHVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL21vZGVscy9jYXRhbG9naW5nLWV4ZWN1dGlvbi1wcm9kdWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRCwyRUFBMkU7QUFDOUQsUUFBQSwwQkFBMEIsR0FBRztJQUN4QyxTQUFTLEVBQUUsa0JBQWtCO0lBQzdCLFlBQVk7SUFDWixVQUFVLEVBQUUscUNBQXFDO0lBQ2pELFlBQVksRUFBRSxnQ0FBZ0M7SUFDOUMsVUFBVSxFQUFFLGdFQUFnRTtJQUM1RSxVQUFVLEVBQUUsdUNBQXVDO0lBQ25ELFVBQVUsRUFBRSwyQkFBMkI7SUFDdkMsU0FBUztJQUNULGNBQWM7SUFDZCxPQUFPLEVBQUUsc0JBQXNCO0NBQ3ZCLENBQUM7QUFJWDs7Ozs7OztHQU9HO0FBQ1UsUUFBQSwwQkFBMEIsR0FBRyxhQUFLO0tBQzVDLE1BQU0sQ0FBQyw4QkFBOEIsRUFBRTtJQUN0QyxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUNqRCxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMxQixVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUV4QixNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsa0NBQTBCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFFdEUsa0VBQWtFO0lBQ2xFLDhEQUE4RDtJQUM5RCx5QkFBeUIsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBRWxELHdEQUF3RDtJQUN4RCxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLDBGQUEwRjtJQUMxRixnQkFBZ0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLHNDQUFzQztJQUN0QyxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLGdCQUFnQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFFekMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFFL0Isb0VBQW9FO0lBQ3BFLHlFQUF5RTtJQUN6RSxXQUFXLEVBQUUsYUFBSyxDQUFDLEtBQUssRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFFakMsNEVBQTRFO0lBQzVFLHdCQUF3QixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakQsbUJBQW1CLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Q0FDL0MsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0lBQ3JELEVBQUUsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0lBQ25EO1FBQ0UsRUFBRSxFQUFFLENBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQztRQUNsQyxNQUFNLEVBQUUsSUFBSTtRQUNaLEtBQUssRUFBRSxvQkFBb0I7S0FDNUI7Q0FDRixDQUFDLENBQUM7QUFFTCxrQkFBZSxrQ0FBMEIsQ0FBQyJ9