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
export declare const SITE_REGISTRY_MODULE = "demo_store";
/** Tabla física del registro. El renombre semántico fue a `/admin/sites`, no acá. */
export declare const SITE_REGISTRY_TABLE = "demo_store";
