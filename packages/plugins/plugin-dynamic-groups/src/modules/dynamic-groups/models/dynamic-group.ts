import { model } from '@medusajs/framework/utils';

/**
 * Grupo dinámico: una "regla viva". Cada grupo administra un customer_group
 * NATIVO de Medusa (`customer_group_id`) — el módulo agrega/quita clientes de
 * ese grupo según las `conditions`. Lo que ya depende de customer groups
 * (banners, y a futuro promos/precios) reacciona solo.
 */
export const DynamicGroup = model
  .define('dynamic_group', {
    id: model.id({ prefix: 'dgrp' }).primaryKey(),
    name: model.text(),
    handle: model.text(),
    description: model.text().nullable(),
    // customer_group nativo administrado por este grupo dinámico.
    customer_group_id: model.text().nullable(),
    // 'all' = AND, 'any' = OR.
    match: model.text().default('all'),
    // [{ field, operator, value, days? }]
    conditions: model.json(),
    // 'realtime' (eventos) | 'manual'.
    update_mode: model.text().default('realtime'),
    is_active: model.boolean().default(true),
    last_run_at: model.dateTime().nullable(),
    last_run_stats: model.json().nullable(),
    metadata: model.json().nullable(),
    /**
     * La tienda dueña del grupo. `NULL` = global de la instancia.
     *
     * Los logs de membresía cuelgan del grupo y heredan su tienda por la FK.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    { on: ['handle'] },
    { on: ['is_active'] },
    { on: ['customer_group_id'] },
  ]);

export default DynamicGroup;
