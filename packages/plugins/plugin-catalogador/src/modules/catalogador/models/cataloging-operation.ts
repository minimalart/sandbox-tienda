import { model } from '@medusajs/framework/utils';

/** Familia de operación elegida en el Paso 2 del wizard (PRD §12). */
export const OPERATION_TYPES = [
  'text_field', // enriquecimiento textual mediante IA
  'image_technical', // procesamiento técnico determinístico de imágenes
  'image_ai', // generación/recreación de imágenes mediante IA
] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

export const OPERATION_STATUSES = ['pending', 'running', 'done', 'error'] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

/**
 * CatalogingOperation — una operación (campo/transformación) seleccionada para
 * la ejecución (PRD §24). `field` identifica el campo de texto (p.ej.
 * 'description', 'meta_title', 'categories') o la operación de imagen
 * (p.ej. 'to_webp', 'lifestyle'). `configuration` guarda parámetros específicos.
 */
export const CatalogingOperation = model
  .define('cataloging_operation', {
    id: model.id({ prefix: 'catop' }).primaryKey(),
    execution_id: model.text(),
    type: model.enum([...OPERATION_TYPES]),
    field: model.text(),
    configuration: model.json().nullable(),
    status: model.enum([...OPERATION_STATUSES]).default('pending'),
  })
  .indexes([{ on: ['execution_id'], where: 'deleted_at IS NULL' }]);

export default CatalogingOperation;
