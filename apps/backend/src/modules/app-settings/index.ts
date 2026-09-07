import { Module } from '@medusajs/framework/utils';
import warmAppSettingsSnapshot from './loaders/warm-snapshot';

export const APP_SETTINGS_MODULE = 'appSettings';

/**
 * `app-settings` como MÓDULO existe por una sola razón: hospedar el loader.
 *
 * El módulo ya no tiene modelos ni tabla propia — la configuración vive en
 * `site_setting`, que es del módulo de tiendas — y su API son las FUNCIONES de
 * `service.ts`, que reciben el container del llamador. El motivo está escrito
 * ahí: el container que Medusa le da a un service de módulo es hermético y no
 * puede resolver `demo_store`, así que un service registrado degradaría todas
 * las lecturas a `process.env` en silencio.
 *
 * Pero el loader NO se puede mover a ningún otro lado: es el único hook de Medusa
 * que corre ANTES del primer request y recibe `PG_CONNECTION`, y sin él el
 * snapshot sincrónico nunca se llena — o sea, Typesense, el kill switch de gift
 * cards y GA4 leerían `process.env` para siempre. `Module()` exige un `service`
 * (`load-internal.js:119`: "No service found in module"), así que va uno inerte.
 *
 * Se registra SIN `optionalModule` en `medusa-config.ts` a propósito: es core, no
 * una extensión.
 */

/**
 * Marcador. NO tiene métodos y no debe tenerlos NUNCA.
 *
 * Medusa lo instancia con `new AppSettingsModuleService(localContainer.cradle)`,
 * donde `localContainer` sólo conoce seis claves y NO incluye `demo_store`. Todo
 * método que pusieras acá leería una configuración vacía y caería al entorno sin
 * un solo error en los logs. Si necesitás leer o escribir ajustes, importá las
 * funciones de `./service` y pasales `req.scope`.
 */
class AppSettingsModuleService {}

export default Module(APP_SETTINGS_MODULE, {
  service: AppSettingsModuleService,
  loaders: [warmAppSettingsSnapshot],
});
