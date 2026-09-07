export { VIMEO_VIDEO_MODULE } from './modules/vimeo-video';
export { default as VimeoVideoModule } from './modules/vimeo-video';
export type { default as VimeoVideoModuleService } from './modules/vimeo-video/service';

/**
 * Este plugin NO expone setters propios. La coordinación con el host se
 * resuelve vía `@minimalart/mercatto-plugin-runtime`:
 *
 * - App-settings del namespace `extension:videos` → el plugin lee con
 *   `getAppSettingsSyncReader()`.
 *
 * El host registra el reader una vez al arrancar. Sin bridge, el plugin cae a
 * `process.env` — misma semántica que la extensión con snapshot vacío.
 */
