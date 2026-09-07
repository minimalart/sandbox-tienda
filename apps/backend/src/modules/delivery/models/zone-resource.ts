import { model } from '@medusajs/framework/utils';

/**
 * ZoneResource — asignación de un recurso de flota propia (driver o vehicle) a
 * una DeliveryZone.
 *
 * Es una entidad del módulo delivery (tabla 'delivery_zone_resource'), NO un
 * link cross-module: tanto `delivery_zone_id` como `resource_id` son FK lógicas
 * al MISMO módulo (DeliveryZone / Driver / Vehicle). Por eso vive como modelo
 * propio y no como defineLink.
 *
 * Modela la relación N:M zona↔recursos: qué drivers y qué vehículos pueden
 * operar en una zona. La elegibilidad efectiva (capacidad, turno, carga actual)
 * se calcula on-the-fly más adelante; acá solo declaramos la pertenencia.
 *
 *  - `resource_type`: 'driver' | 'vehicle' (ResourceType en types.ts).
 *  - `resource_id`: id del Driver o Vehicle según `resource_type`.
 *  - `active`: permite desafectar un recurso sin borrar la fila.
 *
 * Unicidad: (delivery_zone_id, resource_type, resource_id) entre filas vivas
 * (índice único parcial WHERE deleted_at IS NULL) — un recurso no se asigna dos
 * veces a la misma zona.
 */
export const ZoneResource = model
  .define(
    { name: 'zone_resource', tableName: 'delivery_zone_resource' },
    {
      id: model.id({ prefix: 'zres' }).primaryKey(),
      delivery_zone_id: model.text(),
      // 'driver' | 'vehicle'
      resource_type: model.text(),
      resource_id: model.text(),
      active: model.boolean().default(true),
      metadata: model.json().nullable(),
    },
  )
  .indexes([
    { on: ['delivery_zone_id', 'resource_type'], where: 'deleted_at IS NULL' },
    { on: ['resource_id'], where: 'deleted_at IS NULL' },
    {
      on: ['delivery_zone_id', 'resource_type', 'resource_id'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
  ]);

export default ZoneResource;
