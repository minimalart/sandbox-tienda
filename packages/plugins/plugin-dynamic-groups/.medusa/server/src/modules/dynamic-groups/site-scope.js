"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DYNAMIC_GROUP_LOG_SITE_SCOPE = exports.DYNAMIC_GROUP_SITE_SCOPE = void 0;
/** Los grupos dinámicos son por tienda; `NULL` = global de la instancia. */
exports.DYNAMIC_GROUP_SITE_SCOPE = {
    kind: 'site_column',
    table: 'dynamic_group',
    column: 'site_id',
    empty: 'all',
};
/** Los logs cuelgan del grupo: sin grupo son huérfanos. */
exports.DYNAMIC_GROUP_LOG_SITE_SCOPE = {
    kind: 'via_parent',
    table: 'dynamic_group_membership_log',
    fk: 'dynamic_group_id',
    parent: exports.DYNAMIC_GROUP_SITE_SCOPE,
    empty: 'unassigned',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2R5bmFtaWMtZ3JvdXBzL3NpdGUtc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsNEVBQTRFO0FBQy9ELFFBQUEsd0JBQXdCLEdBQXdCO0lBQzNELElBQUksRUFBRSxhQUFhO0lBQ25CLEtBQUssRUFBRSxlQUFlO0lBQ3RCLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQztBQUVGLDJEQUEyRDtBQUM5QyxRQUFBLDRCQUE0QixHQUF3QjtJQUMvRCxJQUFJLEVBQUUsWUFBWTtJQUNsQixLQUFLLEVBQUUsOEJBQThCO0lBQ3JDLEVBQUUsRUFBRSxrQkFBa0I7SUFDdEIsTUFBTSxFQUFFLGdDQUF3QjtJQUNoQyxLQUFLLEVBQUUsWUFBWTtDQUNwQixDQUFDIn0=