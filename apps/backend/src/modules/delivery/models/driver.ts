import { model } from '@medusajs/framework/utils';

/**
 * Driver — repartidor de flota propia (own_fleet).
 *
 * Es una entidad del módulo delivery, NO un link. `store_location_id` apunta a
 * la sucursal a la que pertenece (FK lógica cross-module: se valida en
 * aplicación, no por constraint). `user_id` es el id del admin User de Medusa
 * con el que el driver se autentica en la PWA: la relación 1:1 vive en el link
 * src/links/driver-user.ts (no como columna FK física), pero se denormaliza acá
 * para resolver el driver desde el user autenticado sin un graph extra.
 *
 * `status` es el estado de disponibilidad operativa del repartidor
 * (available | on_route | offline), independiente del estado de cada entrega.
 */
export const Driver = model
  .define('driver', {
    id: model.id({ prefix: 'drv' }).primaryKey(),
    name: model.text(),
    phone: model.text().nullable(),
    email: model.text().nullable(),
    // available | on_route | offline
    status: model.text().default('offline'),
    // Sucursal (StoreLocation) a la que pertenece — FK lógica cross-module.
    store_location_id: model.text().nullable(),
    // Admin User con el que se autentica en la PWA (1:1 vía link driver-user).
    user_id: model.text().nullable(),
    // Tope de entregas activas simultáneas que admite el driver (null = sin tope
    // explícito). La carga ACTUAL no se persiste: se calcula on-the-fly contra
    // las DeliveryExecution no terminales asignadas a este driver.
    max_active_deliveries: model.number().nullable(),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['status'], where: 'deleted_at IS NULL' },
    { on: ['store_location_id'], where: 'deleted_at IS NULL' },
    { on: ['user_id'], where: 'deleted_at IS NULL' },
  ]);

export default Driver;
