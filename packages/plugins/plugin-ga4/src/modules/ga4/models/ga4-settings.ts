import { model } from '@medusajs/framework/utils';

/**
 * Ga4Settings — fila única de configuración de GA4. **LEGACY.**
 *
 * Nació como el reemplazo de las env vars, antes de que existiera
 * `app-settings`. Hoy la fuente de verdad es `site_setting`
 * (namespace `extension:ga4`) y esta tabla quedó como capa de compatibilidad:
 * cada columna NO nula sigue pisando al env, pero pierde contra una fila de
 * `site_setting` guardada desde la card del admin. La mezcla vive en
 * `modules/ga4/settings.ts` (`mergeWithLegacyRow`), con el orden justificado.
 *
 * No se migran los datos ni se dropea la tabla a propósito: hay instalaciones
 * con el measurement id y el api secret sólo acá, y moverlos implicaría escribir
 * en la tabla de otro módulo desde una migración, cifrado incluido.
 *
 * `api_secret` es sensible: nunca se devuelve por la API (se expone solo el flag
 * api_secret_set) y solo se actualiza cuando llega un valor no vacío.
 */
export const Ga4Settings = model
  .define('ga4_settings', {
  id: model.id({ prefix: 'gaset' }).primaryKey(),
  /**
   * Discriminante de la fila global. Existe SÓLO para poder indexarla.
   *
   * La global es `site_id IS NULL`, y un `UNIQUE (site_id) WHERE site_id IS NULL` no
   * restringe nada: en un único de Postgres los NULL no colisionan entre sí. Hace falta
   * una columna con valor real, igual que `singleton_key` en `gift_card_settings`.
   */
  singleton_key: model.text().default('default'),
  measurement_id: model.text().nullable(),
  api_secret: model.text().nullable(),
  gtm_id: model.text().nullable(),
  debug: model.boolean().default(false),
  metadata: model.json().nullable(),
  /**
   * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia.
   *
   * Cada tienda puede medir en su propia propiedad de GA4 —son marcas distintas y los
   * informes no se mezclan—, pero la que no configuró la suya sigue heredando la
   * global, que es la sembrada desde las env.
   */
  site_id: model.text().nullable(),
})
  .indexes([
    // DOS parciales: en Postgres `NULL != NULL`, así que uno solo dejaría pasar dos
    // filas globales y `getSettings` devolvería cualquiera según el plan.
    // El global va sobre `singleton_key` porque indexar `site_id` no sirve cuando el
    // predicado es justamente `site_id IS NULL` (ver el comentario del campo).
    // Creado por `Migration20260807260000Ga4SettingsGlobalUnique`.
    //
    // Los `name` van explícitos —y no autogenerados— para que coincidan con los de las
    // migraciones: sin eso `db:generate` no reconoce el índice que ya está en la DB y
    // propone crear el mismo con otro nombre.
    {
      name: 'IDX_ga4_settings_global_unique',
      on: ['singleton_key'],
      unique: true,
      where: 'site_id IS NULL AND deleted_at IS NULL',
    },
    {
      name: 'IDX_ga4_settings_site_unique',
      on: ['site_id'],
      unique: true,
      where: 'site_id IS NOT NULL AND deleted_at IS NULL',
    },
    { name: 'IDX_ga4_settings_site', on: ['site_id'] },
  ]);

export default Ga4Settings;
