import type { SiteScopeDescriptor } from '../../lib/multistore';

/**
 * A qué tiendas aplica un banner.
 *
 * Es la ÚNICA forma anidada del repo: los ids no están en una columna propia sino
 * dentro de `rules.sales_channel_ids`, junto al resto de las reglas de segmentación
 * (`customer_group_id`, `locale`, `country`, `device`, `path`).
 *
 * `empty: 'all'` mantiene la semántica del lado store: un banner sin canales en sus
 * reglas se muestra en todas las tiendas.
 */
export const BANNER_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_array_json',
  table: 'banner',
  column: 'rules',
  path: ['sales_channel_ids'],
  empty: 'all',
};

/**
 * El mismo eje, pero descrito sobre el ARRAY INTERNO en vez de sobre `rules`.
 *
 * Existe por la misma razón que `PDF_CATALOG_ROW_SCOPE`, que es su precedente
 * exacto: `siteDefaults` devuelve `{}` para `channel_array_json` a propósito —el
 * anidado se escribe con la forma del propio recurso y adivinarla adentro del helper
 * produciría un payload inválido—, así que el call site que CREA un banner se
 * quedaba sin ninguna manera de pedir "los canales de la tienda activa" y terminaba
 * no pidiéndolos. Con este descriptor, `siteDefaults` devuelve
 * `{ sales_channel_ids: [...] }`, que es exactamente el objeto que va DENTRO de
 * `rules`.
 *
 * La alternativa descartada era leer `resolution.site.channel_ids` a mano en la
 * ruta: funciona, pero saltea el único lugar donde está escrito qué pasa con
 * `allSites`, `singleSite` y `registryAbsent` —los tres tienen que NO estampar— y
 * cada call site que lo copiara sería otra oportunidad de olvidarse de uno.
 *
 * `empty` calcado del descriptor de arriba a propósito: son el mismo eje visto de
 * dos formas, y si divergen, listar y crear dejan de estar de acuerdo.
 */
/*
  SÓLO PARA `siteDefaults`. No se lo pases a `siteFilter` ni a `assertIdInSite`.

  `column` acá NO es una columna de Postgres: `banner` no tiene `sales_channel_ids`,
  tiene `rules` (jsonb). Es el nombre de la CLAVE que `siteDefaults` va a poner en el
  objeto que después se mergea adentro de `rules`.

  Ese doble sentido es del tipo compartido, no de este descriptor: `column` significa
  columna SQL cuando lo consume `siteFilter`/`assertIdInSite`, y nombre de propiedad
  cuando lo consume `assertRowInSite`/`siteDefaults`. `PDF_CATALOG_ROW_SCOPE` tiene
  exactamente la misma forma y tampoco apunta a una columna real.

  El riesgo es que `SiteScopeDescriptor` los deja intercambiables, así que el compilador
  acepta `siteFilter(scope, res, BANNER_RULES_SITE_SCOPE)` y eso emitiría
  `SELECT id FROM banner WHERE "sales_channel_ids" IS NULL` → Postgres 42703 en runtime.
  Hoy no pasa: los dos únicos usos son `siteDefaults`. Queda escrito acá porque el tipo
  no lo puede impedir y el nombre invita a lo contrario.

  Para filtrar banners va `BANNER_SITE_SCOPE`, el de arriba, que sí describe el jsonb.
*/
export const BANNER_RULES_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_array',
  table: 'banner',
  column: 'sales_channel_ids',
  empty: 'all',
};
