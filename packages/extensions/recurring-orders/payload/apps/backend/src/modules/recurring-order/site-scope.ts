import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * La suscripción pertenece al canal donde se creó, y ese campo NO es nullable: no hay
 * suscripción sin canal.
 *
 * `empty: 'unassigned'` en consecuencia — pero es defensivo, no una decisión: si
 * apareciera una fila sin canal sería por una corrupción, y mostrarla en todas las
 * tiendas dejaría a cualquier operador pausarle la entrega a un cliente ajeno.
 *
 * Ojo con el contraste dentro del mismo módulo: `recurring_setting` y
 * `recurring_offer` sí usan `NULL` como fallback GLOBAL, así que van con
 * `pickBySitePrecedence`. Confundirlos es exactamente el fail-open que documenta
 * EXTENSIONES-MULTITIENDA.md.
 */
export const RECURRING_ORDER_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'recurring_order',
  column: 'sales_channel_id',
  empty: 'unassigned',
};

/** Un plan global se consulta como fallback, pero sólo se muta desde la vista global. */
export const SUBSCRIPTION_PLAN_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'subscription_plan',
  column: 'sales_channel_id',
  empty: 'unassigned',
};

/** Los incidentes sin canal son inconsistencias operativas, no recursos compartidos. */
export const SUBSCRIPTION_ALERT_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'subscription_alert',
  column: 'sales_channel_id',
  empty: 'unassigned',
};

/** Los motivos globales se ven como fallback y se administran únicamente en vista global. */
export const SUBSCRIPTION_CANCELLATION_REASON_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'subscription_cancellation_reason',
  column: 'sales_channel_id',
  empty: 'unassigned',
};

/**
 * `empty: 'unassigned'` — y es LO CONTRARIO de lo que hace el listado hermano, que
 * consulta `sales_channel_id: [...channels, null]` para incluir las globales. La
 * diferencia es deliberada y no es un descuido de copiar el filtro:
 *
 *   LISTAR una oferta global es correcto: es CONTEXTO. El propio listado lo explica —
 *   "el operador tiene que ver de dónde sale cada precio, y una oferta global que no
 *   aparece se descubre por el ticket del cliente".
 *
 *   BORRARLA no lo es: la global es el FALLBACK de toda tienda que no definió la suya,
 *   así que borrarla desde la pantalla de una le cambia el precio de suscripción a todas
 *   las demás. Es exactamente lo que el POST hermano ya se niega a hacer, con el mismo
 *   argumento escrito: "Guardarla en la global cambiaría el precio de todas las
 *   tiendas". Un DELETE que sí puede tocarla dejaría al módulo protegiendo la escritura
 *   y regalando el borrado, que es la misma media migración con otra cara.
 *
 * Contrapartida asumida: el operador ve la oferta global en su lista y come un 404 si la
 * intenta borrar. Es el precio de que el listado sea informativo; el que quiera tocar la
 * global tiene que hacerlo desde donde no haya tienda activa.
 *
 * Esto es la misma distinción que este archivo ya documenta arriba para
 * `recurring_setting`, la razón por la que esa se resuelve con `pickBySitePrecedence` y
 * no con `siteFilter`. O sea: este descriptor sirve para GUARDS de escritura, no para
 * listar — el listado usa a propósito otro predicado.
 */
export const RECURRING_OFFER_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'recurring_offer',
  column: 'sales_channel_id',
  empty: 'unassigned',
};

/**
 * El ciclo de renovación no tiene eje propio: hereda la tienda de su suscripción por
 * `recurring_order_id`.
 *
 * `empty: 'unassigned'`: un ciclo sin suscripción no existe. Es huérfano, no global —
 * al revés que `recurring_offer`, donde `NULL` sí es un fallback deliberado.
 */
export const RENEWAL_CYCLE_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'renewal_cycle',
  fk: 'recurring_order_id',
  parent: RECURRING_ORDER_SITE_SCOPE,
  empty: 'unassigned',
};
