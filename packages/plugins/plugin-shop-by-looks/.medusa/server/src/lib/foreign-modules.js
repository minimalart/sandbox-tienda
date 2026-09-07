"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_SETTING_KEYS = exports.STORE_CONFIG_MODULE = void 0;
/**
 * Claves y tipos de modulos AJENOS al plugin, resueltos por string en runtime.
 *
 * El plugin depende del modulo `storeConfig` del host
 * (`apps/backend/src/modules/store-config`) para leer el toggle maestro de la
 * seccion Shop by Look — la clave `shop_by_look_enabled` sobre la API generica
 * `readSetting`. Como ese modulo vive en el host y no se puede importar aca sin
 * acoplar el bundle del plugin al arbol de archivos del host, se resuelve por
 * LITERAL en `req.scope.resolve(STORE_CONFIG_MODULE)` — el mismo patron que usa
 * `lib/multistore/module-key.ts` para `demo_store` y el plugin catalogador
 * usa para `storeConfig`.
 *
 * Si el host no tiene `storeConfig` registrado, el `resolve` tira y la ruta
 * publica del storefront devuelve 500. Es lo mismo que pasaba en la extension
 * antes de la migracion — coherente con la dependencia declarada en
 * `mercatto-plugin.json` (`storeConfig`).
 */
exports.STORE_CONFIG_MODULE = 'storeConfig';
/**
 * Claves del host `store-config` que este plugin consume. Solo `SHOP_BY_LOOK_ENABLED`
 * hoy — se declara aca para evitar el riesgo de driftear el literal en cada uso.
 *
 * Ojo: el host tiene un catalogo mucho mas grande de claves. Copiar SOLO lo que
 * el plugin usa; agregar mas claves acopla el plugin a decisiones del host que
 * hoy no lo tocan.
 */
exports.STORE_SETTING_KEYS = {
    SHOP_BY_LOOK_ENABLED: 'shop_by_look_enabled',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yZWlnbi1tb2R1bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9mb3JlaWduLW1vZHVsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7R0FnQkc7QUFDVSxRQUFBLG1CQUFtQixHQUFHLGFBQWEsQ0FBQztBQUVqRDs7Ozs7OztHQU9HO0FBQ1UsUUFBQSxrQkFBa0IsR0FBRztJQUNoQyxvQkFBb0IsRUFBRSxzQkFBc0I7Q0FDcEMsQ0FBQyJ9