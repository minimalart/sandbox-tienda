import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * En qué tiendas está activo un catálogo PDF.
 *
 * Es la ÚNICA forma `join_table` del repo: la pertenencia no vive en el catálogo
 * sino en `pdf_catalog_channel`, una fila por activación, con un UNIQUE parcial que
 * garantiza "un solo catálogo activo por canal".
 *
 * `empty: 'all'`: un catálogo SIN activaciones es un borrador, y tiene que verse en
 * el listado — si no, nunca podrías activarlo desde una tienda. Ponerle
 * `'unassigned'` escondería todo catálogo recién creado.
 */
export const PDF_CATALOG_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'join_table',
  table: 'pdf_catalog',
  joinTable: 'pdf_catalog_channel',
  fk: 'catalog_id',
  column: 'sales_channel_id',
  empty: 'all',
};

/**
 * El mismo scope, pero sobre la fila YA HIDRATADA por `retrieveWithChannels`, que
 * aplana los canales de la join table en un `sales_channel_ids`.
 *
 * Existe porque `assertRowInSite` no puede resolver una `join_table` desde una fila
 * plana —la pertenencia vive en otra tabla y adivinarla dejaría pasar escrituras
 * cruzadas—, pero sí puede leer el array que esa función ya trajo. Usar
 * `PDF_CATALOG_SITE_SCOPE` para LISTAR y este para GUARDAR el detalle.
 */
export const PDF_CATALOG_ROW_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_array',
  table: 'pdf_catalog',
  column: 'sales_channel_ids',
  empty: 'all',
};
