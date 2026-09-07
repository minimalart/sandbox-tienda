import { model } from '@medusajs/framework/utils';

/**
 * Route (M7) — agrupa varias DeliveryExecutions de FLOTA PROPIA en una ruta
 * asignada a un driver/vehicle, con paradas (RouteStop) ordenadas manualmente.
 *
 * SOLO FLOTA PROPIA: una ruta agrupa ejecuciones con provider_type='own_fleet'.
 * Andreani y store_pickup NO se rutean (el carrier maneja su propio ruteo; el
 * retiro en tienda no tiene recorrido). El workflow create-route filtra esto.
 *
 * Relación con DeliveryExecution: cada ejecución ruteada lleva `route_id` (FK
 * lógica al mismo módulo, columna ya existente desde M3) y aparece como un
 * RouteStop. NO se duplican datos de la orden ni de la dirección: el detalle se
 * lee en vivo con query.graph a través del link delivery_execution_order. Acá
 * solo vive el estado operativo de la ruta y el orden de las paradas.
 *
 * `optimization_meta` queda reservado para M8 (optimización automática del
 * orden de paradas): en M7 el orden es 100% manual.
 */
export const Route = model
  .define('delivery_route', {
    id: model.id({ prefix: 'rt' }).primaryKey(),
    // Código legible de la ruta (generado, ej. 'RT-20260622-001').
    code: model.text(),
    // Driver / Vehicle asignados a TODA la ruta (FK lógica al mismo módulo).
    // Al despachar (dispatch-route), se propaga a cada ejecución vía assign-delivery.
    driver_id: model.text().nullable(),
    vehicle_id: model.text().nullable(),
    // Sucursal de origen de la ruta (FK lógica a store-location).
    store_location_id: model.text().nullable(),
    // planned | dispatched | in_progress | completed | canceled (ver types.ts).
    status: model.text().default('planned'),
    // Fecha planificada de ejecución de la ruta.
    planned_date: model.dateTime().nullable(),
    // Timestamps operativos de la ruta (separados de los de cada ejecución).
    started_at: model.dateTime().nullable(),
    completed_at: model.dateTime().nullable(),
    // Reservado M8: metadatos de optimización del orden de paradas.
    optimization_meta: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['status'], where: 'deleted_at IS NULL' },
    { on: ['driver_id'], where: 'deleted_at IS NULL' },
    { on: ['planned_date'], where: 'deleted_at IS NULL' },
  ]);

export default Route;
