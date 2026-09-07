import { model } from '@medusajs/framework/utils';

/**
 * ErpConfig — configuración de la integración ERP. MVP: una sola fila
 * (un ERP activo por tienda); el unique por provider deja lugar a
 * multi-config futura sin migrar.
 *
 * `credentials_enc` guarda TODAS las credenciales del provider como un JSON
 * cifrado (AES-256-GCM, ver `crypto.ts`) — nunca se devuelve por API.
 * `settings` es el cajón flexible por provider/flujo (ver `ErpConfigSettings`).
 */
export const ErpConfig = model
  .define('erp_config', {
    id: model.id({ prefix: 'erpcfg' }).primaryKey(),
    provider: model.text(),
    country_code: model.text().default('AR'),
    enabled: model.boolean().default(false),
    stock_sync_enabled: model.boolean().default(false),
    catalog_sync_enabled: model.boolean().default(false),
    sales_notify_enabled: model.boolean().default(false),
    credentials_enc: model.text().nullable(),
    settings: model.json().nullable(),
    last_validated_at: model.dateTime().nullable(),
    last_validation_ok: model.boolean().nullable(),
    last_validation_error: model.text().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([{ on: ['provider'], unique: true, where: 'deleted_at IS NULL' }]);
