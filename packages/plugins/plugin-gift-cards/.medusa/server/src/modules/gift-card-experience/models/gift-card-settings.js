"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftCardSettings = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.GiftCardSettings = utils_1.model
    .define('gift_card_settings', {
    id: utils_1.model.id({ prefix: 'gcsettings' }).primaryKey(),
    singleton_key: utils_1.model.text().default('default'),
    enabled: utils_1.model.boolean().default(false),
    timezone: utils_1.model.text().default('America/Argentina/Buenos_Aires'),
    morning_time: utils_1.model.text().default('09:00'),
    afternoon_time: utils_1.model.text().default('14:00'),
    evening_time: utils_1.model.text().default('19:00'),
    schedule_horizon_days: utils_1.model.number().default(365),
    default_expiry_days: utils_1.model.number().nullable(),
    default_design_id: utils_1.model.text().default('brand-default'),
    max_name_length: utils_1.model.number().default(80),
    max_message_length: utils_1.model.number().default(300),
    retry_delays_minutes: utils_1.model.json().default({ delays: [1, 5, 30, 120, 720] }),
    fallback_to_buyer: utils_1.model.boolean().default(true),
    balance_reminder_days: utils_1.model.number().nullable(),
    expiring_notice_days: utils_1.model.number().nullable(),
    legal_text: utils_1.model.text().nullable(),
    terms_url: utils_1.model.text().nullable(),
    merchandising_url: utils_1.model.text().nullable(),
    updated_by: utils_1.model.text().nullable(),
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, que es
     * el fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: `singleton_key` sigue existiendo para no romper nada,
     * pero la unicidad ahora es por (site_id, singleton_key) y necesita DOS índices
     * parciales — en Postgres `NULL != NULL`, así que uno solo dejaría pasar dos filas
     * globales y `getSettings` devolvería cualquiera de las dos según el plan.
     */
    site_id: utils_1.model.text().nullable(),
})
    .indexes([
    { on: ['singleton_key'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'singleton_key'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2lmdC1jYXJkLXNldHRpbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZ2lmdC1jYXJkLWV4cGVyaWVuY2UvbW9kZWxzL2dpZnQtY2FyZC1zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSxnQkFBZ0IsR0FBRyxhQUFLO0tBQ2xDLE1BQU0sQ0FBQyxvQkFBb0IsRUFBRTtJQUM1QixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUNuRCxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDOUMsT0FBTyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ3ZDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLGdDQUFnQyxDQUFDO0lBQ2hFLFlBQVksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztJQUMzQyxjQUFjLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDN0MsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQzNDLHFCQUFxQixFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO0lBQ2xELG1CQUFtQixFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDOUMsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUM7SUFDeEQsZUFBZSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQzNDLGtCQUFrQixFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO0lBQy9DLG9CQUFvQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUM1RSxpQkFBaUIsRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUNoRCxxQkFBcUIsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hELG9CQUFvQixFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0MsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbkMsU0FBUyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQyxVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuQzs7Ozs7Ozs7T0FRRztJQUNILE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2pDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLHdDQUF3QyxFQUFFO0lBQ3hGLEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLDRDQUE0QyxFQUFFO0lBQ3ZHLEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUU7Q0FDcEIsQ0FBQyxDQUFDIn0=