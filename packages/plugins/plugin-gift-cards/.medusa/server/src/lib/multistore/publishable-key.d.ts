import type { MedusaRequest } from '@medusajs/framework/http';
import type { SiteResolution } from './types';
/** Los canales que la publishable key de esta request habilita. `[]` sin key. */
export declare const channelsFromPublishableKey: (req: MedusaRequest) => string[];
/**
 * `allowMainFallback` va en `false` a propósito, igual que en el admin.
 *
 * Es tentador prenderlo —"el storefront quiere la principal"— pero acá significaría
 * que una key sin canal, o con un canal que no es de ninguna tienda, resuelve a la
 * tienda PRINCIPAL y filtra por ella. Es decir: el visitante de una demo mal
 * configurada vería el contenido de la principal creyendo que es el de la demo. Con
 * `false` el resultado es `allSites`/`registryAbsent`, que NO filtra — se ve de más,
 * pero se ve lo que ya se veía, y eso no es una regresión silenciosa.
 */
export declare function siteFromPublishableKey(req: MedusaRequest): Promise<SiteResolution>;
/**
 * El `site_id` de esta request, o `null` para la fila GLOBAL.
 *
 * Es el atajo para las tablas de configuración con precedencia
 * (`readSetting(key, siteId)`): ahí `null` NO significa "sin filtrar", significa
 * "la fila global", que es exactamente lo que corresponde cuando no hay tienda
 * resuelta.
 *
 * Ojo: para LISTAR filas de datos hay que usar `siteFromPublishableKey` y
 * `siteFilter`, no esto. Colapsar la resolución en un `string | null` pierde la
 * distinción entre `singleSite` —no filtrar— y `site` —filtrar—, que es justo la
 * que evita que un proyecto mono-tienda se esconda sus propias filas.
 */
export declare function siteIdFromPublishableKey(req: MedusaRequest): Promise<string | null>;
