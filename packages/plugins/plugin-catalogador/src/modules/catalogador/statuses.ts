/**
 * El enum de estados de una corrida, SIN imports del framework.
 *
 * Vivía dentro de `models/cataloging-execution.ts`, que importa
 * `@medusajs/framework/utils` para el `model.define`. Eso hacía que cualquier
 * módulo puro que necesitara la lista —o cualquier test que quisiera recorrerla—
 * arrastrara el framework entero y quedara fuera del alcance de `node --test`.
 *
 * El modelo lo re-exporta, así que para el resto del código nada cambió.
 */

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
