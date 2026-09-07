export { GA4_MODULE } from './modules/ga4';
export { default as Ga4Module } from './modules/ga4';

/**
 * Este plugin NO expone setters propios. La coordinación con el host se
 * resuelve vía `@minimalart/mercatto-plugin-runtime`:
 *
 * - App-settings del namespace `extension:ga4` → el plugin lee con
 *   `getAppSettingsSyncReader()`.
 *
 * El host registra el reader una vez al arrancar. Sin bridge, el plugin cae a
 * `process.env` — misma semántica que la extensión con snapshot vacío.
 */
