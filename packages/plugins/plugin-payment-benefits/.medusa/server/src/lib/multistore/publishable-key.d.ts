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
 * (`getSettings(siteId)`, `readSetting(key, siteId)`): ahí `null` NO significa "sin
 * filtrar", significa "la fila global", que es exactamente lo que corresponde cuando
 * no hay tienda resuelta.
 *
 * `singleSite` cae en `null` igual que `allSites` y `registryAbsent`, y es el MISMO
 * criterio que `siteIdOfChannel`: ahí la key no identificó ninguna tienda, así que la
 * fila global no es "la de otra" — es la única que hay.
 *
 * OJO con lo que `singleSite` NO significa: `resolveSite` devuelve `site` en cuanto una
 * pista MATCHEA, ANTES de contar cuántas tiendas existen. O sea que un proyecto con una
 * sola tienda y su publishable key bien emitida resuelve `site` y SÍ filtra. Es
 * correcto, y es lo que hace que agregar la segunda tienda no cambie nada: todos los
 * descriptores que se filtran del lado store llevan `empty: 'all'`, así que las filas
 * globales —las anteriores a la columna, que son todas en una instalación vieja— se
 * siguen viendo.
 *
 * Ojo: para LISTAR filas de datos hay que usar `siteFromPublishableKey` y
 * `siteFilter`, no esto. Colapsar la resolución en un `string | null` pierde la
 * distinción entre `singleSite` —no filtrar— y `site` —filtrar—, que es justo la que
 * evita que un proyecto mono-tienda se esconda sus propias filas.
 */
export declare function siteIdFromPublishableKey(req: MedusaRequest): Promise<string | null>;
