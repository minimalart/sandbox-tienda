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
export declare const STORE_CONFIG_MODULE = "storeConfig";
/**
 * Tipo estructural del subset de `StoreConfigModuleService` que las rutas y
 * el pipeline del Catalogador consumen. Se declara aca para no importar el
 * service real (que vive en el host). Si el shape de estos metodos cambia en
 * el host, actualizar ambos lados.
 *
 * A diferencia de plugin-landing-pages —que usa `getAiConfig()`—, el
 * Catalogador persiste su config completa como un unico setting key/value
 * y solo necesita read/upsert generico.
 *
 * `siteId` puede ser `null` para apuntar a la fila GLOBAL (fallback de toda
 * tienda sin config propia). Ver `siteOf` en `api/admin/catalogador/_shared.ts`.
 */
export type StoreConfigLike = {
    readSetting: (key: string, siteId?: string | null) => Promise<{
        value: unknown;
    } | undefined>;
    upsertSetting: (key: string, value: unknown, siteId?: string | null) => Promise<unknown>;
};
