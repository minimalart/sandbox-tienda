"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicGroup = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Grupo dinámico: una "regla viva". Cada grupo administra un customer_group
 * NATIVO de Medusa (`customer_group_id`) — el módulo agrega/quita clientes de
 * ese grupo según las `conditions`. Lo que ya depende de customer groups
 * (banners, y a futuro promos/precios) reacciona solo.
 */
exports.DynamicGroup = utils_1.model
    .define('dynamic_group', {
    id: utils_1.model.id({ prefix: 'dgrp' }).primaryKey(),
    name: utils_1.model.text(),
    handle: utils_1.model.text(),
    description: utils_1.model.text().nullable(),
    // customer_group nativo administrado por este grupo dinámico.
    customer_group_id: utils_1.model.text().nullable(),
    // 'all' = AND, 'any' = OR.
    match: utils_1.model.text().default('all'),
    // [{ field, operator, value, days? }]
    conditions: utils_1.model.json(),
    // 'realtime' (eventos) | 'manual'.
    update_mode: utils_1.model.text().default('realtime'),
    is_active: utils_1.model.boolean().default(true),
    last_run_at: utils_1.model.dateTime().nullable(),
    last_run_stats: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
    /**
     * La tienda dueña del grupo. `NULL` = global de la instancia.
     *
     * Los logs de membresía cuelgan del grupo y heredan su tienda por la FK.
     */
    site_id: utils_1.model.text().nullable(),
})
    .indexes([
    { on: ['handle'] },
    { on: ['is_active'] },
    { on: ['customer_group_id'] },
]);
exports.default = exports.DynamicGroup;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1pYy1ncm91cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2R5bmFtaWMtZ3JvdXBzL21vZGVscy9keW5hbWljLWdyb3VwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRDs7Ozs7R0FLRztBQUNVLFFBQUEsWUFBWSxHQUFHLGFBQUs7S0FDOUIsTUFBTSxDQUFDLGVBQWUsRUFBRTtJQUN2QixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM3QyxJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNwQixXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyw4REFBOEQ7SUFDOUQsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQywyQkFBMkI7SUFDM0IsS0FBSyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ2xDLHNDQUFzQztJQUN0QyxVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN4QixtQ0FBbUM7SUFDbkMsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO0lBQzdDLFNBQVMsRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUN4QyxXQUFXLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN4QyxjQUFjLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN2QyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQzs7OztPQUlHO0lBQ0gsT0FBTyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDakMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUU7SUFDbEIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRTtJQUNyQixFQUFFLEVBQUUsRUFBRSxDQUFDLG1CQUFtQixDQUFDLEVBQUU7Q0FDOUIsQ0FBQyxDQUFDO0FBRUwsa0JBQWUsb0JBQVksQ0FBQyJ9