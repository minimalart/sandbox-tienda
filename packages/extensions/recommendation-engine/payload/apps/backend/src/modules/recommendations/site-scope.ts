import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * `empty: 'all'` en los dos: `sales_channel_id NULL` significa GLOBAL —se aplica en
 * todas las tiendas—, no huérfano. Es lo que el propio modelo declara en su comentario
 * y lo que el motor de serve respeta al resolver la cadena efectiva.
 */
export const RECOMMENDATION_STRATEGY_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'recommendation_strategy',
  column: 'sales_channel_id',
  empty: 'all',
};

export const RECOMMENDATION_PLACEMENT_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'recommendation_placement',
  column: 'sales_channel_id',
  empty: 'all',
};

/**
 * La misma forma sobre la tercera tabla. No es un eje inventado: los tres datos que lo
 * fijan ya estaban escritos antes de que existiera el guard que lo usa
 * (`admin/recommendations/relations/:id`):
 *   - el modelo: `sales_channel_id: model.text().nullable(), // NULL = todos los canales`
 *   - el listado hermano, que filtra `sales_channel_id: [...channel_ids, null]`
 *   - el POST hermano, que NO fuerza canal: una relación creada sin canal nace global a
 *     propósito
 *
 * De ahí sale `empty: 'all'` y no `'unassigned'`: `NULL` acá significa "de todas", no
 * "huérfana". Ponerle `'unassigned'` habría dado un guard MÁS estricto que el listado —
 * el operador ve la relación global en su pantalla y se come un 404 al desactivarla,
 * mientras el POST le sigue dejando crear otra igual.
 */
export const RECOMMENDATION_RELATION_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'recommendation_relation',
  column: 'sales_channel_id',
  empty: 'all',
};
