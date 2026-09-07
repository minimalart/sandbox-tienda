"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRAND_SITE_SCOPE = void 0;
/**
 * Cómo una marca declara a qué tiendas pertenece.
 *
 * Vive al lado del modelo y no en la ruta a propósito: la forma física es una
 * propiedad de la tabla, y si cada ruta la repitiera, migrar el modelo obligaría a
 * cazar todas las copias.
 *
 * `empty: 'all'` es la semántica que el storefront ya aplica (ver el comentario de
 * `api/store/brands/route.ts`): `sales_channel_ids` vacío o `NULL` significa "visible
 * en todas las tiendas", NO "de nadie". Cambiarlo a `'unassigned'` escondería todas
 * las marcas globales del listado.
 */
exports.BRAND_SITE_SCOPE = {
    kind: 'channel_array',
    table: 'brand',
    column: 'sales_channel_ids',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2JyYW5kL3NpdGUtc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUE7Ozs7Ozs7Ozs7O0dBV0c7QUFDVSxRQUFBLGdCQUFnQixHQUF3QjtJQUNuRCxJQUFJLEVBQUUsZUFBZTtJQUNyQixLQUFLLEVBQUUsT0FBTztJQUNkLE1BQU0sRUFBRSxtQkFBbUI7SUFDM0IsS0FBSyxFQUFFLEtBQUs7Q0FDYixDQUFDIn0=