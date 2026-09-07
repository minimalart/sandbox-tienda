import { model } from '@medusajs/framework/utils';

/**
 * Config por evento built-in de ecommerce (purchase, add_to_cart, etc.). Guarda
 * SOLO el estado configurable: si está activo, si está oculto ("borrado") y un
 * override del nombre GA4. El payload lo arma el código (lib/builtin-dispatchers).
 * Una fila por builtin_key; si no existe fila, el default es activo, visible y
 * con el nombre del catálogo.
 */
export const Ga4BuiltinSetting = model
  .define('ga4_builtin_setting', {
    id: model
      .id({
        prefix: 'ga4bi',
      })
      .primaryKey(),
    builtin_key: model.text(),
    is_active: model.boolean().default(true),
    // "Borrado" por el usuario: sale de la lista y nunca dispara. Como el catálogo
    // vive en código no se puede recrear de cero → es reversible (restaurar).
    hidden: model.boolean().default(false),
    // Override del nombre de evento GA4; si es null se usa el default del catálogo.
    ga4_event_name: model.text().nullable(),
    /**
     * La tienda dueña de esta fila. `NULL` = GLOBAL, el fallback de toda tienda que no
     * defina la suya para esa clave.
     *
     * Sirve para que una marca mida un evento propio (o le cambie el nombre) sin
     * tocárselo a las otras, que comparten el mapeo por defecto.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    { on: ['builtin_key'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'builtin_key'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
  ]);
