import { model } from '@medusajs/framework/utils';

/** Momento del snapshot respecto de la aplicación (PRD §19). */
export const SNAPSHOT_TYPES = ['pre', 'post'] as const;

export type SnapshotType = (typeof SNAPSHOT_TYPES)[number];

/**
 * CatalogingSnapshot — estado exacto de los campos afectados de un producto,
 * antes (`pre`) y después (`post`) de aplicar (PRD §19). Guarda sólo lo
 * necesario para recuperar: valores textuales, relaciones, metadata, refs +
 * orden de imágenes, estado de publicación. Pertenece a la ejecución (no es una
 * sección independiente del menú, PRD §19.3).
 */
export const CatalogingSnapshot = model
  .define('cataloging_snapshot', {
    id: model.id({ prefix: 'catsnap' }).primaryKey(),
    execution_id: model.text(),
    product_id: model.text(),
    type: model.enum([...SNAPSHOT_TYPES]),
    data: model.json().nullable(),
  })
  .indexes([
    { on: ['execution_id'], where: 'deleted_at IS NULL' },
    { on: ['execution_id', 'product_id', 'type'], where: 'deleted_at IS NULL' },
  ]);

export default CatalogingSnapshot;
