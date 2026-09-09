import { model } from '@medusajs/framework/utils';

// El enum de estados vive en `../statuses.ts`, sin imports del framework: este
// archivo trae `@medusajs/framework/utils` para el `model.define`, y eso dejaba la
// lista de estados —y cualquier regla escrita sobre ella— fuera de `node --test`.
// Se re-exporta acá para que los call sites de siempre no cambien.
export {
  EXECUTION_STATUSES,
  EXECUTION_KINDS,
  type ExecutionStatus,
} from '../statuses';
import { EXECUTION_KINDS, EXECUTION_STATUSES } from '../statuses';

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
