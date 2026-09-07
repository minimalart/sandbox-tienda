import { model } from '@medusajs/framework/utils';

/**
 * Estados funcionales de una ejecución (PRD §8). La transición la controla el
 * service; la UI y los workflows sólo leen/escriben estados válidos.
 */
export const EXECUTION_STATUSES = [
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
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/** Tipo de ejecución: normal (enriquecimiento) o restauración de otra. */
export const EXECUTION_KINDS = ['enrichment', 'restoration'] as const;

/**
 * CatalogingExecution — un proceso completo de enriquecimiento (PRD §7). Guarda
 * la selección exacta de productos, la config efectiva (con prompts congelados),
 * el avance y el resumen. Los cambios propuestos/aceptados viven en los productos
 * de la ejecución (cataloging_execution_product).
 */
export const CatalogingExecution = model
  .define('cataloging_execution', {
    id: model.id({ prefix: 'catexec' }).primaryKey(),
    name: model.text(),
    status: model.enum([...EXECUTION_STATUSES]).default('draft'),
    kind: model.enum([...EXECUTION_KINDS]).default('enrichment'),
    created_by: model.text().nullable(),
    /**
     * La tienda desde la que se lanzó la corrida. `NULL` = anterior a la columna.
     *
     * OJO con lo que esto NO significa: el producto que la corrida enriquece es
     * COMPARTIDO por toda la instancia. Esto scopea el HISTORIAL —quién corrió qué y
     * cuándo—, que es lo que el operador de una tienda necesita ver sin el ruido de
     * las demás. El efecto sigue siendo global, y el listado lo dice.
     */
    site_id: model.text().nullable(),

    // Ciclo de vida
    generation_started_at: model.dateTime().nullable(),
    generation_completed_at: model.dateTime().nullable(),
    apply_started_at: model.dateTime().nullable(),
    applied_at: model.dateTime().nullable(),
    cancelled_at: model.dateTime().nullable(),

    // Trazabilidad de origen (reflotar / restaurar)
    restored_from_execution_id: model.text().nullable(),
    duplicated_from_execution_id: model.text().nullable(),

    // Config efectiva usada + versión de prompts congelada (PRD §14.1)
    configuration_snapshot: model.json().nullable(),
    // Definición de la selección (filtros aplicados) — NO se re-ejecuta al
    // retomar salvo pedido explícito (PRD §11.5). Los IDs exactos van aparte.
    selection_definition: model.json().nullable(),
    selection_count: model.number().default(0),

    // Costo de IA agregado de la ejecución (suma de sus productos). `ai_cost_usd`
    // es columna propia para poder ordenar/sumar por SQL; `ai_usage` guarda el
    // desglose (texto vs imagen, tokens, llamadas por modelo).
    ai_cost_usd: model.float().default(0),
    ai_usage: model.json().nullable(),

    // Agregados de avance/resultado/errores (json)
    progress: model.json().nullable(),
    summary: model.json().nullable(),
    error_summary: model.json().nullable(),
  })
  .indexes([
    { on: ['status'], where: 'deleted_at IS NULL' },
    { on: ['created_by'], where: 'deleted_at IS NULL' },
    { on: ['site_id'], where: 'deleted_at IS NULL' },
  ]);

export default CatalogingExecution;
