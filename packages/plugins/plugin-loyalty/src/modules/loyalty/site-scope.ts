import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * El programa de fidelidad es el único que lleva la tienda; todo lo demás la hereda.
 *
 * `empty: 'all'` en el programa es deliberado y transitorio: los programas anteriores
 * a la columna quedan en `NULL` y se ven desde cualquier tienda. Apagarlos el día del
 * deploy sería desactivar el programa vivo sin avisar, y los clientes lo notarían
 * antes que el operador.
 */
export const LOYALTY_PROGRAM_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'loyalty_program',
  column: 'site_id',
  empty: 'all',
};

/** Fábrica para las tablas que cuelgan del programa por FK directa. */
const viaProgram = (table: string): SiteScopeDescriptor => ({
  kind: 'via_parent',
  table,
  fk: 'program_id',
  parent: LOYALTY_PROGRAM_SITE_SCOPE,
  // Una fila sin programa es huérfana: no es "de todas", es de ninguna. Distinto del
  // programa mismo, donde `NULL` sí significa global.
  empty: 'unassigned',
});

export const LOYALTY_TIER_SITE_SCOPE = viaProgram('loyalty_tier');
export const LOYALTY_REWARD_SITE_SCOPE = viaProgram('loyalty_reward');
export const LOYALTY_CAMPAIGN_SITE_SCOPE = viaProgram('loyalty_campaign');
export const LOYALTY_EARN_RULE_SITE_SCOPE = viaProgram('loyalty_earn_rule');

/** Los grants llegan a su tienda con dos saltos: grant → reward → program. */
export const LOYALTY_REWARD_GRANT_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'loyalty_reward_grant',
  fk: 'reward_id',
  parent: LOYALTY_REWARD_SITE_SCOPE,
  empty: 'unassigned',
};

/**
 * Los MOVIMIENTOS de puntos cuelgan del programa que los generó, y el programa ya sabe
 * su tienda: cero columnas nuevas.
 *
 * Ojo con lo que esto NO hace: el SALDO (`points_account`) sigue siendo uno por
 * cliente en toda la instancia, y es deliberado. Partirlo por tienda dividiría en dos
 * el saldo de un cliente que ya compró en las dos, y esa plata es del cliente — no se
 * puede "migrar" sin decidir a quién le sacás puntos. Lo que sí tiene tienda es DÓNDE
 * se ganó o gastó cada punto, que es lo que el backoffice mira.
 *
 * `empty: 'all'`: un movimiento sin programa es legacy o manual. Esconderlo haría que
 * los totales del tablero no cierren con el saldo, y ahí el operador deja de creerle
 * al número.
 */
export const POINTS_TRANSACTION_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'points_transaction',
  fk: 'program_id',
  parent: LOYALTY_PROGRAM_SITE_SCOPE,
  empty: 'all',
};
