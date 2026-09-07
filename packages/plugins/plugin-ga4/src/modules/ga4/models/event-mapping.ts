import { model } from '@medusajs/framework/utils';

export const Ga4EventMapping = model
  .define('ga4_event_mapping', {
    id: model
      .id({
        prefix: 'ga4map',
      })
      .primaryKey(),
    medusa_event: model.text(),
    ga4_event_name: model.text(),
    is_active: model.boolean().default(true),
    description: model.text().nullable(),
    // Array of { ga4_param, source_path?, static_value? }
    param_mappings: model.json().nullable(),
    metadata: model.json().nullable(),
    /**
     * La tienda dueña de esta fila. `NULL` = GLOBAL, el fallback de toda tienda que no
     * defina la suya para esa clave.
     *
     * Sirve para que una marca mida un evento propio (o le cambie el nombre) sin
     * tocárselo a las otras, que comparten el mapeo por defecto.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    // DOS parciales: en Postgres `NULL != NULL`, así que uno solo sobre
    // (site_id, medusa_event, ga4_event_name) dejaría pasar dos globales idénticos.
    {
      on: ['medusa_event', 'ga4_event_name'],
      unique: true,
      where: 'site_id IS NULL AND deleted_at IS NULL',
    },
    {
      on: ['site_id', 'medusa_event', 'ga4_event_name'],
      unique: true,
      where: 'site_id IS NOT NULL AND deleted_at IS NULL',
    },
    { on: ['site_id'] },
  ]);
