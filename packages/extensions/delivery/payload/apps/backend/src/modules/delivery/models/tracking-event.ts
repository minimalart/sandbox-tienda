import { model } from '@medusajs/framework/utils';

/**
 * TrackingEvent — timeline unificado APPEND-ONLY de una DeliveryExecution.
 *
 * Registra, normalizados a un vocabulario común, los eventos del recorrido
 * físico vengan de donde vengan:
 *   - source='andreani' → derivados del estadoId del carrier (pollStatus).
 *   - source='driver'   → eventos de la app de repartidores (flota propia).
 *   - source='system'   → hitos internos (creación del sidecar, etc.).
 *
 * Es un registro INMUTABLE: nunca se updatea una fila existente; cada hito es
 * una fila nueva. La idempotencia de ingesta se garantiza con el índice único
 * parcial sobre (delivery_execution_id, external_code, occurred_at): reintentar
 * el mismo poll de Andreani no duplica eventos.
 *
 * NO es un link de Medusa: `delivery_execution_id` es una FK lógica dentro del
 * MISMO módulo delivery (mismo schema), no una referencia cross-module. Por eso
 * vive como columna indexada y no como defineLink.
 */
export const TrackingEvent = model
  .define('tracking_event', {
    id: model.id({ prefix: 'devt' }).primaryKey(),
    // FK lógica a delivery_execution (mismo módulo). Indexada para el timeline.
    delivery_execution_id: model.text(),
    // Origen del evento: 'andreani' | 'driver' | 'system'.
    source: model.text(),
    // Código interno normalizado del hito (vocabulario común, ver normalizer):
    // 'created' | 'assigned' | 'admitted' | 'in_transit' | 'at_pickup_point'
    // | 'delivered' | 'failed_attempt' | ...
    code: model.text(),
    // Código crudo del carrier que originó el mapeo (ej. estadoId Andreani).
    external_code: model.text().nullable(),
    description: model.text().nullable(),
    // Cuándo ocurrió el hito según la fuente (no cuándo se ingirió).
    occurred_at: model.dateTime(),
    // Geolocalización opcional del evento: { lat, lng }.
    location: model.json().nullable(),
    // Payload crudo de la fuente, para auditoría / reproceso.
    raw: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    // Orden natural del timeline.
    {
      on: ['delivery_execution_id', 'occurred_at'],
      where: 'deleted_at IS NULL',
    },
    // DEDUPE / idempotencia de ingesta: un mismo (execution, external_code,
    // occurred_at) no puede insertarse dos veces. external_code puede ser NULL
    // (eventos de sistema/driver sin código de carrier); en Postgres dos NULL
    // no colisionan, así que esos hitos no se dedupean por esta vía — la
    // idempotencia de 'created' la garantiza el chequeo del service.
    {
      on: ['delivery_execution_id', 'external_code', 'occurred_at'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
  ]);

export default TrackingEvent;
