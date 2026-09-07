import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteHint, SiteRef, SiteResolution } from './types';
/**
 * Resolución de la tienda de una request, vía container.
 *
 * Para services de módulo y providers —que reciben un container AISLADO y no pueden
 * resolver otros módulos— existe el gemelo `resolve-site-sql.ts`, que hace lo mismo
 * por knex. Los dos tienen que dar el mismo `SiteRef`; hay un test de paridad.
 */
type SiteRow = {
    id: string;
    slug: string;
    name: string;
    is_main: boolean;
    sales_channel_id: string | null;
    b2b_sales_channel_id: string | null;
    region_id: string | null;
    stock_location_id: string | null;
};
export declare const toSiteRef: (row: SiteRow) => SiteRef;
/**
 * Resuelve la tienda a partir de las pistas disponibles.
 *
 * Orden: `siteId` → `slug` → `salesChannelId` (matcheando AMBAS columnas de canal)
 * → `orderId`/`cartId` → `is_main` (sólo con `allowMainFallback`) → `allSites`.
 *
 * Nunca tira por una pista que no matchea un formato esperado: la única forma de
 * terminar en `unknownSite` es haber pedido una tienda concreta que no existe.
 */
export declare function resolveSite(container: MedusaContainer, hint?: SiteHint): Promise<SiteResolution>;
/**
 * El `site_id` de un canal, o `null` si no hay eje de tienda que aplicar.
 *
 * Es el puente que necesita todo el trabajo SIN request: un `order.placed` trae
 * `sales_channel_id`, pero las tablas que llevan tienda propia —`loyalty_program`,
 * `gift_card_settings`— se filtran por `site_id`. Traducir a mano en cada call site
 * es exactamente cómo aparecen las variantes: una que colapsa `singleSite` en la
 * tienda y otra que no, y las dos "funcionan" hasta que hay dos tiendas.
 *
 * `null` significa LA FILA GLOBAL (`site_id IS NULL`), no "la principal". Se llega
 * ahí con `singleSite`, `allSites` y `registryAbsent`, y es deliberado: con una sola
 * tienda —o sin registro— la global no es "la de otra", es la única que hay. Es el
 * mismo criterio que `pickBySitePrecedence` con `inherit-global`, y el que ya usan
 * `siteOf(req)` en el admin y `store/gift-card-experience/designs`.
 *
 * `unknownSite` también cae en `null` y NO rompe: acá no hay operador que eligió mal
 * una tienda —hay una orden ya cobrada— y abortar el earn o la emisión por un canal
 * huérfano sería castigar al cliente por una fila del registro.
 */
export declare function siteIdOfChannel(container: MedusaContainer, salesChannelId: string | null | undefined): Promise<string | null>;
/** Todas las tiendas. Lo usan los jobs que hacen fan-out. */
export declare function listSites(container: MedusaContainer, options?: {
    includeMain?: boolean;
}): Promise<SiteRef[]>;
export {};
