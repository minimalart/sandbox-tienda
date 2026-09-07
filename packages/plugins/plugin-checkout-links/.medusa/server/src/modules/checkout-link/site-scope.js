"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKOUT_LINK_SITE_SCOPE = void 0;
/**
 * `empty: 'all'` — un link sin canal usa el por defecto y se ve desde cualquier tienda.
 *
 * Era una de las tres semánticas que este proyecto había dejado sin decidir. La
 * decisión: mostrar de más es recuperable, esconder no. Un link de checkout sigue
 * FUNCIONANDO por su token aunque el admin no lo liste —es público—, así que
 * esconderlo no lo desactiva: sólo hace que el operador crea que desapareció y arme
 * otro, mientras el viejo sigue vendiendo.
 */
exports.CHECKOUT_LINK_SITE_SCOPE = {
    kind: 'channel_column',
    table: 'checkout_link',
    column: 'sales_channel_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NoZWNrb3V0LWxpbmsvc2l0ZS1zY29wZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQTs7Ozs7Ozs7R0FRRztBQUNVLFFBQUEsd0JBQXdCLEdBQXdCO0lBQzNELElBQUksRUFBRSxnQkFBZ0I7SUFDdEIsS0FBSyxFQUFFLGVBQWU7SUFDdEIsTUFBTSxFQUFFLGtCQUFrQjtJQUMxQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUMifQ==