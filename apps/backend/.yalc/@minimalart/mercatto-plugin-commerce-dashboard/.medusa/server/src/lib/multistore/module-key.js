"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_REGISTRY_TABLE = exports.SITE_REGISTRY_MODULE = void 0;
/**
 * ÚNICO literal de la clave del módulo de registro de tiendas en todo el repo.
 *
 * Se resuelve por string y no importando `DEMO_STORE_MODULE` porque
 * `project-composer` BORRA `src/modules/demo-store` de todo proyecto de cliente
 * (`component-definitions.js`, componente `demo-creator`), y un import colgado
 * rompería el build del backend del cliente.
 *
 * El precio de ese desacople es que el literal puede driftear de la constante sin
 * que nada falle: `modules/module-keys.test.ts` es lo que lo convierte en test rojo.
 * Si agregás otro archivo que resuelva este módulo por string, agregalo ahí.
 */
exports.SITE_REGISTRY_MODULE = 'demo_store';
/** Tabla física del registro. El renombre semántico fue a `/admin/sites`, no acá. */
exports.SITE_REGISTRY_TABLE = 'demo_store';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlLWtleS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvbXVsdGlzdG9yZS9tb2R1bGUta2V5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7Ozs7Ozs7OztHQVdHO0FBQ1UsUUFBQSxvQkFBb0IsR0FBRyxZQUFZLENBQUM7QUFFakQscUZBQXFGO0FBQ3hFLFFBQUEsbUJBQW1CLEdBQUcsWUFBWSxDQUFDIn0=