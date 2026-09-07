import type { SiteColumnScope, SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * Las entregas de gift card cuelgan de la ORDEN que las originó, y la orden de Medusa
 * ya lleva `sales_channel_id`. No hizo falta ninguna columna nueva.
 *
 * `empty: 'unassigned'` en la entrega: una entrega sin orden no existe salvo por un
 * borrado a medias, y mostrarla en todas las tiendas sería peor que no mostrarla.
 * `empty: 'all'` en la orden: una orden sin canal es de antes de que hubiera tiendas.
 */
const ORDER_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'order',
  column: 'sales_channel_id',
  empty: 'all',
};

export const GIFT_CARD_DELIVERY_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'gift_card_delivery',
  fk: 'order_id',
  parent: ORDER_SITE_SCOPE,
  empty: 'unassigned',
};

/**
 * `empty: 'all'` — el diseño sin tienda es el GLOBAL, disponible en todas.
 *
 * No es "sin asignar": incluye al `brand-default` que el servicio siembra, y sin él una
 * tienda se quedaría sin ningún diseño para ofrecer.
 */
export const GIFT_CARD_DESIGN_SITE_SCOPE: SiteColumnScope = {
  kind: 'site_column',
  table: 'gift_card_design',
  column: 'site_id',
  empty: 'all',
};
