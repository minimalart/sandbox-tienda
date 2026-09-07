import type { SiteScopeDescriptor } from '../../lib/multistore';

/**
 * A qué tiendas pertenece un post. Ver `modules/brand/site-scope.ts` para el porqué
 * de tener el descriptor al lado del modelo.
 *
 * Sólo los POSTS llevan canales: las CATEGORÍAS del blog no tienen la columna, así
 * que su listado queda `pending` a propósito en vez de fingir que filtra.
 */
export const BLOG_POST_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_array',
  table: 'blog_post',
  column: 'sales_channel_ids',
  empty: 'all',
};

/**
 * `empty: 'all'` — las categorías sin tienda son taxonomía compartida.
 *
 * Esconderlas dejaría posts publicados apuntando a una categoría que el operador no ve
 * en su listado, y ahí el post se rompe sin que nada avise.
 */
export const BLOG_CATEGORY_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'blog_category',
  column: 'site_id',
  empty: 'all',
};
