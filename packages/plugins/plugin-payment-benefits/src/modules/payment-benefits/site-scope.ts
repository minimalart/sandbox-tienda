import type { SiteColumnScope, SiteScopeDescriptor } from '../../lib/multistore';

/**
 * A qué tiendas aplica un beneficio de pago. Ver `modules/brand/site-scope.ts` para
 * el porqué de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'` lo declara el propio modelo: "vacío = todos".
 */
export const PAYMENT_BENEFIT_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_array',
  table: 'payment_benefit',
  column: 'sales_channel_ids',
  empty: 'all',
};

/**
 * `empty: 'all'` — el catálogo sin tienda es el GLOBAL, sincronizado con las
 * credenciales de entorno. Es el que usa toda tienda que no tenga cuenta propia, así
 * que esconderlo la dejaría sin ningún medio de pago listado.
 */
export const PAYMENT_METHOD_CATALOG_SITE_SCOPE: SiteColumnScope = {
  kind: 'site_column',
  table: 'payment_method_catalog',
  column: 'site_id',
  empty: 'all',
};
