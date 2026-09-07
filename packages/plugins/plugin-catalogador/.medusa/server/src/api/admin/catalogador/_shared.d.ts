import type { MedusaRequest } from '@medusajs/framework/http';
/**
 * La tienda de esta request, en la forma que espera `store-config`.
 *
 * `null` = la fila GLOBAL, que es el fallback de toda tienda sin config propia.
 * `singleSite` cae a global a propósito: con una sola tienda no hay nada que
 * aislar, y es el mismo criterio que `shouldFilter` (`lib/multistore/types.ts`).
 *
 * Vive acá y no en cada ruta porque `readSetting(key, undefined)` NO busca la fila
 * de la tienda: va derecho a la global (`modules/store-config/service.ts`). Una
 * ruta que escriba la config con la tienda activa y otra que la lea sin ella
 * guardan en un lugar y leen de otro, y el valor guardado se pierde sin ningún
 * error — precedente: `/generate` congelaba la config global mientras
 * `/config` guardaba la de la tienda.
 */
export declare const siteOf: (req: MedusaRequest) => Promise<string | null>;
