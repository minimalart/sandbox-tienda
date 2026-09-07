"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BANNER_SITE_SCOPE = void 0;
/**
 * A qué tiendas aplica un banner.
 *
 * Es la ÚNICA forma anidada del repo: los ids no están en una columna propia sino
 * dentro de `rules.sales_channel_ids`, junto al resto de las reglas de segmentación
 * (`customer_group_id`, `locale`, `country`, `device`, `path`).
 *
 * `empty: 'all'` mantiene la semántica del lado store: un banner sin canales en sus
 * reglas se muestra en todas las tiendas.
 */
exports.BANNER_SITE_SCOPE = {
    kind: 'channel_array_json',
    table: 'banner',
    column: 'rules',
    path: ['sales_channel_ids'],
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jhbm5lci9zaXRlLXNjb3BlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBOzs7Ozs7Ozs7R0FTRztBQUNVLFFBQUEsaUJBQWlCLEdBQXdCO0lBQ3BELElBQUksRUFBRSxvQkFBb0I7SUFDMUIsS0FBSyxFQUFFLFFBQVE7SUFDZixNQUFNLEVBQUUsT0FBTztJQUNmLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDO0lBQzNCLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQyJ9