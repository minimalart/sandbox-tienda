export { ABANDONED_CART_MODULE } from './modules/abandoned-cart';
export { default as AbandonedCartModule } from './modules/abandoned-cart';
export type { default as AbandonedCartModuleService } from './modules/abandoned-cart/service';
/**
 * Este plugin NO expone setters propios. La coordinación con el host se
 * resuelve vía `@minimalart/mercatto-plugin-runtime`:
 *
 * - App-settings del namespace `extension:abandoned-cart` → el plugin lee con
 *   `getAppSettingsSyncReader()`.
 * - Templates de WhatsApp desde `kapso-whatsapp/settings` → el plugin lee con
 *   `getExternalReader(EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS)`.
 *
 * El host registra ambos una vez al arrancar. Sin bridge, el plugin cae a
 * `process.env` — misma semántica que la extensión con snapshot vacío.
 */
