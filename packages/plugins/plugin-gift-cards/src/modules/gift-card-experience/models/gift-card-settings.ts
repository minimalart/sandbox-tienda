import { model } from '@medusajs/framework/utils';

export const GiftCardSettings = model
  .define('gift_card_settings', {
    id: model.id({ prefix: 'gcsettings' }).primaryKey(),
    singleton_key: model.text().default('default'),
    enabled: model.boolean().default(false),
    timezone: model.text().default('America/Argentina/Buenos_Aires'),
    morning_time: model.text().default('09:00'),
    afternoon_time: model.text().default('14:00'),
    evening_time: model.text().default('19:00'),
    schedule_horizon_days: model.number().default(365),
    default_expiry_days: model.number().nullable(),
    default_design_id: model.text().default('brand-default'),
    max_name_length: model.number().default(80),
    max_message_length: model.number().default(300),
    retry_delays_minutes: model.json().default({ delays: [1, 5, 30, 120, 720] }),
    fallback_to_buyer: model.boolean().default(true),
    balance_reminder_days: model.number().nullable(),
    expiring_notice_days: model.number().nullable(),
    legal_text: model.text().nullable(),
    terms_url: model.text().nullable(),
    merchandising_url: model.text().nullable(),
    updated_by: model.text().nullable(),
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, que es
     * el fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: `singleton_key` sigue existiendo para no romper nada,
     * pero la unicidad ahora es por (site_id, singleton_key) y necesita DOS índices
     * parciales — en Postgres `NULL != NULL`, así que uno solo dejaría pasar dos filas
     * globales y `getSettings` devolvería cualquiera de las dos según el plan.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    { on: ['singleton_key'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'singleton_key'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
  ]);
