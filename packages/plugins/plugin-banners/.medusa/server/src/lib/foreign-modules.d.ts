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
 * Si el host no tiene `storeConfig` registrado, el `resolve` tira y las 3 rutas
 * AI (ai-generate, ai-image, ai-compose) devuelven 500. Es el mismo comportamiento
 * que tenía la extensión antes de la migración.
 */
export declare const STORE_CONFIG_MODULE = "storeConfig";
/**
 * Tipo estructural del subset de `StoreConfigModuleService` que las rutas de IA
 * consumen. Se declara acá para no importar el service real (que vive en el
 * host). Si el shape del método cambia en el host, actualizar ambos lados.
 */
export type StoreConfigAiConfig = {
    text_model?: string;
    text_max_retries?: number;
    image_model?: string;
    image_size?: '0.5K' | '1K' | '2K';
    image_aspect_ratio?: '21:9' | '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
    image_quality: number;
    image_max_kb: number;
    [key: string]: unknown;
};
export type StoreConfigLike = {
    getAiConfig: () => Promise<StoreConfigAiConfig>;
};
