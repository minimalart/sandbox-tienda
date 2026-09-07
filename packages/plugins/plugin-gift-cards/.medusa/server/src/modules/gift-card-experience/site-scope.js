"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_CARD_DESIGN_SITE_SCOPE = exports.GIFT_CARD_DELIVERY_SITE_SCOPE = void 0;
/**
 * Las entregas de gift card cuelgan de la ORDEN que las originó, y la orden de Medusa
 * ya lleva `sales_channel_id`. No hizo falta ninguna columna nueva.
 *
 * `empty: 'unassigned'` en la entrega: una entrega sin orden no existe salvo por un
 * borrado a medias, y mostrarla en todas las tiendas sería peor que no mostrarla.
 * `empty: 'all'` en la orden: una orden sin canal es de antes de que hubiera tiendas.
 */
const ORDER_SITE_SCOPE = {
    kind: 'channel_column',
    table: 'order',
    column: 'sales_channel_id',
    empty: 'all',
};
exports.GIFT_CARD_DELIVERY_SITE_SCOPE = {
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
exports.GIFT_CARD_DESIGN_SITE_SCOPE = {
    kind: 'site_column',
    table: 'gift_card_design',
    column: 'site_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dpZnQtY2FyZC1leHBlcmllbmNlL3NpdGUtc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUE7Ozs7Ozs7R0FPRztBQUNILE1BQU0sZ0JBQWdCLEdBQXdCO0lBQzVDLElBQUksRUFBRSxnQkFBZ0I7SUFDdEIsS0FBSyxFQUFFLE9BQU87SUFDZCxNQUFNLEVBQUUsa0JBQWtCO0lBQzFCLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQztBQUVXLFFBQUEsNkJBQTZCLEdBQXdCO0lBQ2hFLElBQUksRUFBRSxZQUFZO0lBQ2xCLEtBQUssRUFBRSxvQkFBb0I7SUFDM0IsRUFBRSxFQUFFLFVBQVU7SUFDZCxNQUFNLEVBQUUsZ0JBQWdCO0lBQ3hCLEtBQUssRUFBRSxZQUFZO0NBQ3BCLENBQUM7QUFFRjs7Ozs7R0FLRztBQUNVLFFBQUEsMkJBQTJCLEdBQW9CO0lBQzFELElBQUksRUFBRSxhQUFhO0lBQ25CLEtBQUssRUFBRSxrQkFBa0I7SUFDekIsTUFBTSxFQUFFLFNBQVM7SUFDakIsS0FBSyxFQUFFLEtBQUs7Q0FDYixDQUFDIn0=