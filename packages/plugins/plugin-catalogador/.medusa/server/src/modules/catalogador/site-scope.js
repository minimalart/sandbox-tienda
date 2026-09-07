"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATALOGING_EXECUTION_SITE_SCOPE = void 0;
/**
 * `empty: 'all'` — las corridas anteriores a la columna se ven desde cualquier tienda.
 *
 * Y el `'all'` acá tiene un motivo extra: esconder el historial de enriquecido dejaría
 * sin explicación un producto que cambió. El producto es compartido; el historial de
 * quién lo tocó no puede desaparecer del backoffice que lo está mirando.
 */
exports.CATALOGING_EXECUTION_SITE_SCOPE = {
    kind: 'site_column',
    table: 'cataloging_execution',
    column: 'site_id',
    empty: 'all',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL3NpdGUtc2NvcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUE7Ozs7OztHQU1HO0FBQ1UsUUFBQSwrQkFBK0IsR0FBd0I7SUFDbEUsSUFBSSxFQUFFLGFBQWE7SUFDbkIsS0FBSyxFQUFFLHNCQUFzQjtJQUM3QixNQUFNLEVBQUUsU0FBUztJQUNqQixLQUFLLEVBQUUsS0FBSztDQUNiLENBQUMifQ==