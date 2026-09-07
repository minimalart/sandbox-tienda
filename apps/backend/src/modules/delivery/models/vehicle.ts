import { model } from '@medusajs/framework/utils';

/**
 * Vehicle — vehículo de flota propia (own_fleet).
 *
 * `store_location_ids` son las sucursales (StoreLocation) en las que el vehículo
 * puede operar — un vehículo puede usarse en VARIAS sucursales (FK lógicas
 * cross-module, array). `driver_id` es la asignación DEFAULT del vehículo a un
 * driver (FK lógica al mismo módulo); la asignación efectiva de cada entrega vive
 * en la DeliveryExecution (driver_id / vehicle_id), no acá.
 */
export const Vehicle = model
  .define('vehicle', {
    id: model.id({ prefix: 'veh' }).primaryKey(),
    plate: model.text(),
    // motorcycle | van | truck | car
    type: model.text(),
    capacity_kg: model.number().nullable(),
    capacity_m3: model.number().nullable(),
    // Sucursales (StoreLocation) en las que opera — FK lógicas cross-module.
    // Array de ids; un vehículo puede servir varias sucursales. null = ninguna.
    store_location_ids: model.json().nullable(),
    // Asignación default a un driver (FK lógica al mismo módulo).
    driver_id: model.text().nullable(),
    // Capacidad de frío: el vehículo puede transportar carga refrigerada/congelada.
    has_refrigeration: model.boolean().default(false),
    // Tope de órdenes que el vehículo puede llevar por viaje/ruta (null = sin tope).
    max_orders: model.number().nullable(),
    // Modos de temperatura soportados: array de TemperatureMode
    // (['ambient','refrigerated','frozen']). null = no declarado.
    temperature_modes: model.json().nullable(),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['active'], where: 'deleted_at IS NULL' },
    { on: ['has_refrigeration'], where: 'deleted_at IS NULL' },
  ]);

export default Vehicle;
