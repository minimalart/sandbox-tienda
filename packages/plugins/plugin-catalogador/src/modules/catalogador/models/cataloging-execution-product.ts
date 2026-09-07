import { model } from '@medusajs/framework/utils';

/** Estado de revisión/generación de un producto dentro de la ejecución. */
export const EXECUTION_PRODUCT_STATUSES = [
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
] as const;

export type ExecutionProductStatus = (typeof EXECUTION_PRODUCT_STATUSES)[number];

/**
 * CatalogingExecutionProduct — un producto seleccionado dentro de una ejecución
 * (PRD §24). Persiste el snapshot de los valores al generar (para detectar
 * cambios concurrentes al aplicar, PRD §18.4) y las propuestas por campo.
 *
 * Relación con la ejecución vía `execution_id` (text FK, no relación MikroORM,
 * para mantener migraciones y CRUD simples).
 */
export const CatalogingExecutionProduct = model
  .define('cataloging_execution_product', {
    id: model.id({ prefix: 'catexecp' }).primaryKey(),
    execution_id: model.text(),
    product_id: model.text(),

    status: model.enum([...EXECUTION_PRODUCT_STATUSES]).default('pending'),

    // Referencia de versión (hash/valores base) para detectar cambios
    // posteriores del catálogo antes de aplicar (PRD §17, §18.4).
    product_version_reference: model.json().nullable(),

    // Estado de los campos afectados al momento de generar.
    current_snapshot: model.json().nullable(),
    // Propuestas por campo: { field: { value, attempt, confidence, source_trace, warnings } }
    proposed_changes: model.json().nullable(),
    // Decisiones del usuario (por campo).
    accepted_changes: model.json().nullable(),
    rejected_changes: model.json().nullable(),

    warnings: model.json().nullable(),
    errors: model.json().nullable(),

    // Costo de IA imputado a este producto (acumulado entre reintentos/
    // regeneraciones: cada intento se cobra). `ai_usage` guarda el desglose.
    ai_cost_usd: model.float().default(0),
    ai_usage: model.json().nullable(),

    // Resumen de fuentes externas usadas (catálogo/imagen/barcode/scraping/IA).
    external_context_summary: model.json().nullable(),
    generation_attempts: model.number().default(0),
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

export default CatalogingExecutionProduct;
