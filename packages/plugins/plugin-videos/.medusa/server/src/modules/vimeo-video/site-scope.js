"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIMEO_VIDEO_SITE_SCOPE = void 0;
/**
 * A qué tiendas se muestra un video. Ver `modules/brand/site-scope.ts` para el porqué
 * de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'`: un video sin canales declarados se ve en todas las tiendas, que es
 * como lo trata el storefront hoy.
 */
exports.VIMEO_VIDEO_SITE_SCOPE = {
    kind: 'channel_array',
    table: 'vimeo_video',
    column: 'sales_channel_ids',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3ZpbWVvLXZpZGVvL3NpdGUtc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUE7Ozs7OztHQU1HO0FBQ1UsUUFBQSxzQkFBc0IsR0FBd0I7SUFDekQsSUFBSSxFQUFFLGVBQWU7SUFDckIsS0FBSyxFQUFFLGFBQWE7SUFDcEIsTUFBTSxFQUFFLG1CQUFtQjtJQUMzQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUMifQ==