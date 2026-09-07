import { model } from '@medusajs/framework/utils';

/**
 * Tipos de evento de auditoría (PRD §21 "Actividad" / §32 "Auditoría").
 * No es un enum estricto para permitir eventos futuros sin migración.
 */
export const ACTIVITY_TYPES = [
  'created',
  'generation_started',
  'generation_completed',
  'regenerated',
  'reviewed',
  'edited',
  'apply_started',
  'applied',
  'apply_failed',
  'cancelled',
  'restored',
  'refloated',
  'duplicated',
  'error',
] as const;

/**
 * CatalogingActivity — registro append-only de acciones relevantes (PRD §32).
 * Anota usuario, fecha, producto/campo, acción, valores (anterior/propuesto/
 * aplicado) y herramienta/modelo usado en `metadata`.
 */
export const CatalogingActivity = model
  .define('cataloging_activity', {
    id: model.id({ prefix: 'catact' }).primaryKey(),
    execution_id: model.text(),
    execution_product_id: model.text().nullable(),
    actor_id: model.text().nullable(),
    type: model.text(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['execution_id'], where: 'deleted_at IS NULL' },
    { on: ['execution_product_id'], where: 'deleted_at IS NULL' },
  ]);

export default CatalogingActivity;
