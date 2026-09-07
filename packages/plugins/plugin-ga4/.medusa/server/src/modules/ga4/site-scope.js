"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GA4_BUILTIN_SITE_SCOPE = exports.GA4_EVENT_MAPPING_SITE_SCOPE = void 0;
/**
 * `empty: 'all'` en las dos: la fila sin tienda es el mapeo GLOBAL, el que se aplica a
 * toda tienda que no defina el suyo.
 *
 * No es "sin asignar": esconderla del listado haría que el operador viera eventos
 * llegando a GA4 con un nombre que no aparece en ninguna parte de su backoffice.
 */
exports.GA4_EVENT_MAPPING_SITE_SCOPE = {
    kind: 'site_column',
    table: 'ga4_event_mapping',
    column: 'site_id',
    empty: 'all',
};
exports.GA4_BUILTIN_SITE_SCOPE = {
    kind: 'site_column',
    table: 'ga4_builtin_setting',
    column: 'site_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dhNC9zaXRlLXNjb3BlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBOzs7Ozs7R0FNRztBQUNVLFFBQUEsNEJBQTRCLEdBQXdCO0lBQy9ELElBQUksRUFBRSxhQUFhO0lBQ25CLEtBQUssRUFBRSxtQkFBbUI7SUFDMUIsTUFBTSxFQUFFLFNBQVM7SUFDakIsS0FBSyxFQUFFLEtBQUs7Q0FDYixDQUFDO0FBRVcsUUFBQSxzQkFBc0IsR0FBd0I7SUFDekQsSUFBSSxFQUFFLGFBQWE7SUFDbkIsS0FBSyxFQUFFLHFCQUFxQjtJQUM1QixNQUFNLEVBQUUsU0FBUztJQUNqQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUMifQ==