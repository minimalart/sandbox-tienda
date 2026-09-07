"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOP_BY_LOOK_SITE_SCOPE = void 0;
/**
 * A qué tiendas pertenece un look. Ver `modules/brand/site-scope.ts` (host) para
 * el porqué de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'` es la semántica que ya documenta el propio modelo: "null o array
 * vacío = visible en todas".
 */
exports.SHOP_BY_LOOK_SITE_SCOPE = {
    kind: 'channel_array',
    table: 'shop_by_look',
    column: 'sales_channel_ids',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3Nob3AtYnktbG9vay9zaXRlLXNjb3BlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBOzs7Ozs7R0FNRztBQUNVLFFBQUEsdUJBQXVCLEdBQXdCO0lBQzFELElBQUksRUFBRSxlQUFlO0lBQ3JCLEtBQUssRUFBRSxjQUFjO0lBQ3JCLE1BQU0sRUFBRSxtQkFBbUI7SUFDM0IsS0FBSyxFQUFFLEtBQUs7Q0FDYixDQUFDIn0=