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
export declare const STORE_CONFIG_MODULE = "storeConfig";
/**
 * Claves del host `store-config` que este plugin consume. Solo `SHOP_BY_LOOK_ENABLED`
 * hoy — se declara aca para evitar el riesgo de driftear el literal en cada uso.
 *
 * Ojo: el host tiene un catalogo mucho mas grande de claves. Copiar SOLO lo que
 * el plugin usa; agregar mas claves acopla el plugin a decisiones del host que
 * hoy no lo tocan.
 */
export declare const STORE_SETTING_KEYS: {
    readonly SHOP_BY_LOOK_ENABLED: "shop_by_look_enabled";
};
/**
 * Tipo estructural del subset de `StoreConfigModuleService` que la ruta publica
 * del plugin consume. Se declara aca para no importar el service real (que vive
 * en el host). Si el shape del metodo cambia en el host, actualizar ambos lados.
 *
 * A diferencia del plugin catalogador —que hace read/upsert de una config
 * grande—, Shop by Look solo lee un boolean con precedencia por `siteId` (fila
 * de la tienda con fallback a la fila global). `siteId` puede ser `null` para
 * apuntar a la fila GLOBAL.
 */
export type StoreConfigLike = {
    getBooleanSetting: (key: string, fallback: boolean, siteId?: string | null) => Promise<boolean>;
};
