"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_CONFIG_MODULE = void 0;
/**
 * Claves y tipos de modulos AJENOS al plugin, resueltos por string en runtime.
 *
 * El plugin depende del modulo `storeConfig` del host
 * (`apps/backend/src/modules/store-config`) para persistir la configuracion
 * del Catalogador (key `catalogador_config`) sobre la API generica
 * `readSetting`/`upsertSetting`. Como ese modulo vive en el host y no se
 * puede importar aca sin acoplar el bundle del plugin al arbol de archivos
 * del host, se resuelve por LITERAL en `req.scope.resolve(STORE_CONFIG_MODULE)`
 * — el mismo patron que usa `lib/multistore/module-key.ts` para `demo_store`.
 *
 * Si el host no tiene `storeConfig` registrado, el `resolve` tira y las rutas
 * de config del catalogador devuelven 500. Es lo mismo que pasaba en la
 * extension antes de la migracion — coherente con la dependencia declarada
 * en `mercatto-plugin.json` (`storeConfig`).
 */
exports.STORE_CONFIG_MODULE = 'storeConfig';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yZWlnbi1tb2R1bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9mb3JlaWduLW1vZHVsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7OztHQWVHO0FBQ1UsUUFBQSxtQkFBbUIsR0FBRyxhQUFhLENBQUMifQ==