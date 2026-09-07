import { model } from '@medusajs/framework/utils';

/**
 * DeliveryZone (M6) — atributos OPERATIVOS sobre una geometría existente.
 *
 * La zona NO guarda su propio polígono: referencia el de un `BranchCoverage`
 * del módulo store-location (`branch_coverage_id`). La resolución punto→zona
 * REUSA el PolygonEngine / resolveByPoint de store-location; acá solo colgamos
 * la capa de negocio (pricing, SLA, cutoff, providers habilitados, prioridad).
 *
 * Relaciones cross-módulo:
 *  - `store_location_id` → StoreLocation (sucursal dueña). Vive como link
 *    (src/links/delivery-zone-store-location.ts), la columna es la FK lógica.
 *  - `branch_coverage_id` → BranchCoverage (geometría). FK lógica; la geometría
 *    se lee vía el service de store-location, no se duplica.
 *
 * Campos operativos:
 *  - `pricing_tier`: etiqueta de tarifa (ej. 'urbana', 'extendida'); la lógica
 *    de precio la consume el motor de reglas vía surcharge.
 *  - `sla_hours`: SLA de entrega comprometido para la zona.
 *  - `cutoff_time`: hora de corte 'HH:mm' para despacho mismo día.
 *  - `enabled_providers`: array de provider_type permitidos en la zona
 *    (ej. ['own_fleet','andreani']). Si null, no restringe.
 *  - `priority`: desempate cuando un punto cae en zonas solapadas.
 */
export const DeliveryZone = model
  .define('delivery_zone', {
    id: model.id({ prefix: 'dzone' }).primaryKey(),
    name: model.text(),
    store_location_id: model.text().nullable(),
    branch_coverage_id: model.text().nullable(),
    pricing_tier: model.text().nullable(),
    sla_hours: model.number().nullable(),
    cutoff_time: model.text().nullable(),
    enabled_providers: model.json().nullable(),
    priority: model.number().default(0),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['store_location_id'] },
    { on: ['active'] },
  ]);

export default DeliveryZone;
