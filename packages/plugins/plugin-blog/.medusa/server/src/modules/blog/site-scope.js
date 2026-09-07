"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOG_CATEGORY_SITE_SCOPE = exports.BLOG_POST_SITE_SCOPE = void 0;
/**
 * A qué tiendas pertenece un post. Ver `modules/brand/site-scope.ts` para el porqué
 * de tener el descriptor al lado del modelo.
 *
 * Sólo los POSTS llevan canales: las CATEGORÍAS del blog no tienen la columna, así
 * que su listado queda `pending` a propósito en vez de fingir que filtra.
 */
exports.BLOG_POST_SITE_SCOPE = {
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
exports.BLOG_CATEGORY_SITE_SCOPE = {
    kind: 'site_column',
    table: 'blog_category',
    column: 'site_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jsb2cvc2l0ZS1zY29wZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQTs7Ozs7O0dBTUc7QUFDVSxRQUFBLG9CQUFvQixHQUF3QjtJQUN2RCxJQUFJLEVBQUUsZUFBZTtJQUNyQixLQUFLLEVBQUUsV0FBVztJQUNsQixNQUFNLEVBQUUsbUJBQW1CO0lBQzNCLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQztBQUVGOzs7OztHQUtHO0FBQ1UsUUFBQSx3QkFBd0IsR0FBd0I7SUFDM0QsSUFBSSxFQUFFLGFBQWE7SUFDbkIsS0FBSyxFQUFFLGVBQWU7SUFDdEIsTUFBTSxFQUFFLFNBQVM7SUFDakIsS0FBSyxFQUFFLEtBQUs7Q0FDYixDQUFDIn0=