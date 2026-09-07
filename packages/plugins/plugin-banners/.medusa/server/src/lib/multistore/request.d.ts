import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { SiteHint, SiteResolution } from './types';
/** El admin manda el id, que es inmutable. El slug se acepta sólo para debug con curl. */
export declare const SITE_ID_HEADER = "x-site-id";
export declare const SITE_SLUG_HEADER = "x-site-slug";
/** Valor explícito para "todas las tiendas". Ver la nota de abajo. */
export declare const ALL_SITES = "*";
/**
 * Cuelga las pistas de la request. Registrado para `/admin/*`.
 *
 * `x-site-id: *` es explícito y NO es lo mismo que no mandar el header, aunque hoy
 * los dos resuelvan a `allSites`: distinguirlos es lo que va a permitir prender
 * fail-closed más adelante sin romper a quien todavía no manda nada.
 *
 * `allowMainFallback` es SIEMPRE false en el admin: "sin tienda elegida" significa
 * "todas", no "la principal". Un operador de tres tiendas que ve sólo la principal
 * sin haberlo pedido está viendo un tercio de su data sin ninguna señal.
 */
export declare const attachSiteHint: (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => void;
/**
 * La tienda de esta request. Perezoso y memoizado.
 *
 * Deliberadamente NO deriva de `orderId`/`cartId` en el admin: eso haría que una
 * pantalla de detalle "esté de acuerdo" con la fila que muestra en vez de con lo que
 * el operador eligió, y escondería justo el caso que querés ver — una orden que
 * pertenece a otra tienda.
 */
export declare function siteFromRequest(req: MedusaRequest): Promise<SiteResolution>;
/** Sólo para tests: leer las pistas sin disparar el lookup. */
export declare const siteHintOf: (req: MedusaRequest) => SiteHint | undefined;
