"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_METHOD_CATALOG_SITE_SCOPE = exports.PAYMENT_BENEFIT_SITE_SCOPE = void 0;
/**
 * A qué tiendas aplica un beneficio de pago. Ver `modules/brand/site-scope.ts` para
 * el porqué de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'` lo declara el propio modelo: "vacío = todos".
 */
exports.PAYMENT_BENEFIT_SITE_SCOPE = {
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
exports.PAYMENT_METHOD_CATALOG_SITE_SCOPE = {
    kind: 'site_column',
    table: 'payment_method_catalog',
    column: 'site_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BheW1lbnQtYmVuZWZpdHMvc2l0ZS1zY29wZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQTs7Ozs7R0FLRztBQUNVLFFBQUEsMEJBQTBCLEdBQXdCO0lBQzdELElBQUksRUFBRSxlQUFlO0lBQ3JCLEtBQUssRUFBRSxpQkFBaUI7SUFDeEIsTUFBTSxFQUFFLG1CQUFtQjtJQUMzQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUM7QUFFRjs7OztHQUlHO0FBQ1UsUUFBQSxpQ0FBaUMsR0FBb0I7SUFDaEUsSUFBSSxFQUFFLGFBQWE7SUFDbkIsS0FBSyxFQUFFLHdCQUF3QjtJQUMvQixNQUFNLEVBQUUsU0FBUztJQUNqQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUMifQ==