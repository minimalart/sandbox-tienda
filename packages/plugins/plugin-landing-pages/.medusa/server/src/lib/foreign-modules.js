"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_CONFIG_MODULE = void 0;
/**
 * Claves y tipos de módulos AJENOS al plugin, resueltos por string en runtime.
 *
 * El plugin depende del módulo `storeConfig` del host (`apps/backend/src/modules/store-config`)
 * para leer la config de IA que edita el operador desde la card de "Preferencias
 * → IA". Como ese módulo vive en el host y no se puede importar acá sin acoplar
 * el bundle del plugin al árbol de archivos del host, se resuelve por LITERAL
 * en `req.scope.resolve(STORE_CONFIG_MODULE)` — el mismo patrón que usa
 * `lib/multistore/module-key.ts` para `demo_store`.
 *
 * Si el host no tiene `storeConfig` registrado, el `resolve` tira y las 5 rutas
 * AI (ai-generate, ai-image, ai-improve-copy, ai-seo, ai-translate) devuelven
 * 500. Es lo mismo que pasaba en la extensión antes de la migración.
 */
exports.STORE_CONFIG_MODULE = 'storeConfig';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yZWlnbi1tb2R1bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9mb3JlaWduLW1vZHVsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNVLFFBQUEsbUJBQW1CLEdBQUcsYUFBYSxDQUFDIn0=