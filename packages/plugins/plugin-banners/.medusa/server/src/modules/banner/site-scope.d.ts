import type { SiteScopeDescriptor } from '../../lib/multistore/scope';
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
export declare const BANNER_SITE_SCOPE: SiteScopeDescriptor;
