"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POINTS_TRANSACTION_SITE_SCOPE = exports.LOYALTY_REWARD_GRANT_SITE_SCOPE = exports.LOYALTY_EARN_RULE_SITE_SCOPE = exports.LOYALTY_CAMPAIGN_SITE_SCOPE = exports.LOYALTY_REWARD_SITE_SCOPE = exports.LOYALTY_TIER_SITE_SCOPE = exports.LOYALTY_PROGRAM_SITE_SCOPE = void 0;
/**
 * El programa de fidelidad es el único que lleva la tienda; todo lo demás la hereda.
 *
 * `empty: 'all'` en el programa es deliberado y transitorio: los programas anteriores
 * a la columna quedan en `NULL` y se ven desde cualquier tienda. Apagarlos el día del
 * deploy sería desactivar el programa vivo sin avisar, y los clientes lo notarían
 * antes que el operador.
 */
exports.LOYALTY_PROGRAM_SITE_SCOPE = {
    kind: 'site_column',
    table: 'loyalty_program',
    column: 'site_id',
    empty: 'all',
};
/** Fábrica para las tablas que cuelgan del programa por FK directa. */
const viaProgram = (table) => ({
    kind: 'via_parent',
    table,
    fk: 'program_id',
    parent: exports.LOYALTY_PROGRAM_SITE_SCOPE,
    // Una fila sin programa es huérfana: no es "de todas", es de ninguna. Distinto del
    // programa mismo, donde `NULL` sí significa global.
    empty: 'unassigned',
});
exports.LOYALTY_TIER_SITE_SCOPE = viaProgram('loyalty_tier');
exports.LOYALTY_REWARD_SITE_SCOPE = viaProgram('loyalty_reward');
exports.LOYALTY_CAMPAIGN_SITE_SCOPE = viaProgram('loyalty_campaign');
exports.LOYALTY_EARN_RULE_SITE_SCOPE = viaProgram('loyalty_earn_rule');
/** Los grants llegan a su tienda con dos saltos: grant → reward → program. */
exports.LOYALTY_REWARD_GRANT_SITE_SCOPE = {
    kind: 'via_parent',
    table: 'loyalty_reward_grant',
    fk: 'reward_id',
    parent: exports.LOYALTY_REWARD_SITE_SCOPE,
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
exports.POINTS_TRANSACTION_SITE_SCOPE = {
    kind: 'via_parent',
    table: 'points_transaction',
    fk: 'program_id',
    parent: exports.LOYALTY_PROGRAM_SITE_SCOPE,
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xveWFsdHkvc2l0ZS1zY29wZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQTs7Ozs7OztHQU9HO0FBQ1UsUUFBQSwwQkFBMEIsR0FBd0I7SUFDN0QsSUFBSSxFQUFFLGFBQWE7SUFDbkIsS0FBSyxFQUFFLGlCQUFpQjtJQUN4QixNQUFNLEVBQUUsU0FBUztJQUNqQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUM7QUFFRix1RUFBdUU7QUFDdkUsTUFBTSxVQUFVLEdBQUcsQ0FBQyxLQUFhLEVBQXVCLEVBQUUsQ0FBQyxDQUFDO0lBQzFELElBQUksRUFBRSxZQUFZO0lBQ2xCLEtBQUs7SUFDTCxFQUFFLEVBQUUsWUFBWTtJQUNoQixNQUFNLEVBQUUsa0NBQTBCO0lBQ2xDLG1GQUFtRjtJQUNuRixvREFBb0Q7SUFDcEQsS0FBSyxFQUFFLFlBQVk7Q0FDcEIsQ0FBQyxDQUFDO0FBRVUsUUFBQSx1QkFBdUIsR0FBRyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDckQsUUFBQSx5QkFBeUIsR0FBRyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUN6RCxRQUFBLDJCQUEyQixHQUFHLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdELFFBQUEsNEJBQTRCLEdBQUcsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFFNUUsOEVBQThFO0FBQ2pFLFFBQUEsK0JBQStCLEdBQXdCO0lBQ2xFLElBQUksRUFBRSxZQUFZO0lBQ2xCLEtBQUssRUFBRSxzQkFBc0I7SUFDN0IsRUFBRSxFQUFFLFdBQVc7SUFDZixNQUFNLEVBQUUsaUNBQXlCO0lBQ2pDLEtBQUssRUFBRSxZQUFZO0NBQ3BCLENBQUM7QUFFRjs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ1UsUUFBQSw2QkFBNkIsR0FBd0I7SUFDaEUsSUFBSSxFQUFFLFlBQVk7SUFDbEIsS0FBSyxFQUFFLG9CQUFvQjtJQUMzQixFQUFFLEVBQUUsWUFBWTtJQUNoQixNQUFNLEVBQUUsa0NBQTBCO0lBQ2xDLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQyJ9