import { model } from '@medusajs/framework/utils';

/**
 * Sidecar operativo 1:1 de un Fulfillment de Medusa.
 *
 * NO incluye order_id / fulfillment_id / shipping_option_id como columnas: esas
 * relaciones viven en links (src/links/delivery-execution-*.ts) y se traversan
 * con query.graph. Tampoco copia line items, direcciones ni montos — eso se lee
 * en vivo del Order vía el link. Solo dueña del estado operativo fino.
 */
export const DeliveryExecution = model
  .define('delivery_execution', {
    id: model.id({ prefix: 'dexec' }).primaryKey(),
    // andreani | own_fleet | store_pickup
    provider_type: model.text(),
    // home_delivery | hop | branch_pickup | store_pickup
    service_mode: model.text(),
    // State machine operativa (ver types.ts DELIVERY_TRANSITIONS).
    status: model.text().default('pending'),
    // Id del envío en el carrier (ej. Andreani agrupadorDeBultos).
    external_shipment_id: model.text().nullable(),
    tracking_number: model.text().nullable(),
    label_url: model.text().nullable(),
    // Timestamps OPERATIVOS — separados a propósito de los de Medusa
    // (fulfillment.shipped_at / delivered_at), que siguen siendo la verdad
    // comercial. Acá registramos el detalle fino del recorrido físico.
    assigned_at: model.dateTime().nullable(),
    dispatched_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
    failed_at: model.dateTime().nullable(),
    attempt_count: model.number().default(0),
    // --- Asignación de flota propia (M3) ---
    // Driver/Vehicle asignados a ESTA ejecución (FK lógica al mismo módulo
    // delivery). Distintos de la asignación default del vehículo. Solo aplican a
    // provider_type='own_fleet'; nulls para Andreani. `route_id` reservado para
    // el agrupamiento en rutas (futuro M3+), sin tabla todavía.
    driver_id: model.text().nullable(),
    vehicle_id: model.text().nullable(),
    route_id: model.text().nullable(),
    // --- Scoping por tienda (M10) ---
    // Sucursal (store_location) dueña operativa de ESTA ejecución. FK lógica al
    // módulo store-location (sin constraint cross-tabla, mismo patrón que
    // driver_id / delivery_zone_id). Nullable: NO toda ejecución tiene tienda
    // (ej. Andreani nacional despachado desde un CD sin sucursal mapeada).
    //
    // PRECEDENCIA de resolución (ver create-delivery-execution.ts):
    //   1) delivery_zone.store_location_id de la zona resuelta (señal fuerte: la
    //      zona ya pasó por geometría/reglas y pertenece a una sucursal).
    //   2) fulfillment.location_id (stock location de Medusa) mapeado a la
    //      store_location cuyo stock_location_id coincide.
    //   3) null si ninguna de las anteriores resuelve.
    store_location_id: model.text().nullable(),
    // Ventana de entrega programada (ej. { from, to }).
    scheduled_window: model.json().nullable(),
    delivery_zone_id: model.text().nullable(),
    // --- Costo operativo estimado (Y4) ---
    // Recargo resuelto por el motor de reglas (M6), persistido como COSTO
    // OPERATIVO INTERNO de la entrega (lo que le cuesta a la empresa mover este
    // envío), NO como un cargo al cliente.
    //
    // Por qué NO es un cargo al cliente: las reglas se evalúan en
    // create-delivery-execution, que corre en fulfillment.created — DESPUÉS del
    // checkout, con el envío YA cobrado. Mutar el order/payment acá modificaría
    // una orden ya pagada (incorrecto y peligroso). Por eso el surcharge se
    // guarda solo como métrica de costeo/analytics. Para cobrarle al cliente
    // habría que mover la lógica a la capa de checkout (calculatePrice del
    // shipping option) — fuera de alcance de Y4.
    //
    // En la unidad menor de la moneda (mismo criterio que Quote.amount). Nullable:
    // null = sin recargo resuelto (default), 0 = regla evaluada sin recargo.
    estimated_cost: model.number().nullable(),
    // Último evento operativo recibido (cualquier transición).
    last_event_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['status'], where: 'deleted_at IS NULL' },
    { on: ['provider_type'], where: 'deleted_at IS NULL' },
    { on: ['external_shipment_id'], where: 'deleted_at IS NULL' },
    { on: ['driver_id'], where: 'deleted_at IS NULL' },
    { on: ['store_location_id'], where: 'deleted_at IS NULL' },
  ]);

export default DeliveryExecution;
