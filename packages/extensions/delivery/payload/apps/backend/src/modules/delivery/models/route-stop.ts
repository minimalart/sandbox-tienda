import { model } from '@medusajs/framework/utils';

/**
 * RouteStop (M7) — una parada ordenada dentro de una Route.
 *
 * Cada parada apunta a una DeliveryExecution (FK lógica al mismo módulo) y lleva
 * un `sequence` (1..n) que define el orden manual del recorrido. El planner del
 * admin reordena cambiando estos `sequence` vía el workflow update-route-stops
 * (resecuenciado completo). NO se duplica la dirección de la orden: `lat`/`lng`
 * se copian al crear la parada (snapshot para dibujar el recorrido sin re-query),
 * pero la verdad de la dirección sigue viviendo en la Order linkeada.
 *
 * `status` rastrea el avance fino de la parada durante la ejecución
 * (pending → arrived → completed | failed), independiente del status comercial
 * del Fulfillment y del status operativo de la DeliveryExecution.
 */
export const RouteStop = model
  .define('delivery_route_stop', {
    id: model.id({ prefix: 'rts' }).primaryKey(),
    route_id: model.text(),
    delivery_execution_id: model.text(),
    // Orden manual de la parada en la ruta (1..n). Resecuenciado en update-route-stops.
    sequence: model.number(),
    // pending | arrived | completed | failed (ver types.ts ROUTE_STOP_STATUS).
    status: model.text().default('pending'),
    // ETA estimada de llegada a la parada.
    eta: model.dateTime().nullable(),
    // Timestamps operativos de la parada.
    arrived_at: model.dateTime().nullable(),
    completed_at: model.dateTime().nullable(),
    // Snapshot de coordenadas de la dirección de la orden (para dibujar el
    // recorrido sin re-resolver el link en cada render). Decimales → float.
    lat: model.float().nullable(),
    lng: model.float().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['route_id', 'sequence'], where: 'deleted_at IS NULL' },
    { on: ['delivery_execution_id'], where: 'deleted_at IS NULL' },
  ]);

export default RouteStop;
