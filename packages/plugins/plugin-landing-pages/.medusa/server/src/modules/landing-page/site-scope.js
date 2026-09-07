"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANDING_PAGE_SITE_SCOPE = void 0;
/**
 * `empty: 'all'` — una landing sin canal es global y se publica en todas las tiendas.
 *
 * Acá `NULL` no es "huérfana": es exactamente cómo el storefront la trata, así que el
 * admin tiene que mostrar lo mismo. Si el listado la escondiera, el operador vería una
 * URL viva que no aparece en ninguna parte de su backoffice.
 */
exports.LANDING_PAGE_SITE_SCOPE = {
    kind: 'channel_column',
    table: 'landing_page',
    column: 'sales_channel_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xhbmRpbmctcGFnZS9zaXRlLXNjb3BlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBOzs7Ozs7R0FNRztBQUNVLFFBQUEsdUJBQXVCLEdBQXdCO0lBQzFELElBQUksRUFBRSxnQkFBZ0I7SUFDdEIsS0FBSyxFQUFFLGNBQWM7SUFDckIsTUFBTSxFQUFFLGtCQUFrQjtJQUMxQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUMifQ==