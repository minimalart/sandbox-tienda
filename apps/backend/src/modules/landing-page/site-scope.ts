import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * `empty: 'all'` — una landing sin canal es global y se publica en todas las tiendas.
 *
 * Acá `NULL` no es "huérfana": es exactamente cómo el storefront la trata, así que el
 * admin tiene que mostrar lo mismo. Si el listado la escondiera, el operador vería una
 * URL viva que no aparece en ninguna parte de su backoffice.
 */
export const LANDING_PAGE_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'landing_page',
  column: 'sales_channel_id',
  empty: 'all',
};
