"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogingSnapshot = exports.SNAPSHOT_TYPES = void 0;
const utils_1 = require("@medusajs/framework/utils");
/** Momento del snapshot respecto de la aplicación (PRD §19). */
exports.SNAPSHOT_TYPES = ['pre', 'post'];
/**
 * CatalogingSnapshot — estado exacto de los campos afectados de un producto,
 * antes (`pre`) y después (`post`) de aplicar (PRD §19). Guarda sólo lo
 * necesario para recuperar: valores textuales, relaciones, metadata, refs +
 * orden de imágenes, estado de publicación. Pertenece a la ejecución (no es una
 * sección independiente del menú, PRD §19.3).
 */
exports.CatalogingSnapshot = utils_1.model
    .define('cataloging_snapshot', {
    id: utils_1.model.id({ prefix: 'catsnap' }).primaryKey(),
    execution_id: utils_1.model.text(),
    product_id: utils_1.model.text(),
    type: utils_1.model.enum([...exports.SNAPSHOT_TYPES]),
    data: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['execution_id'], where: 'deleted_at IS NULL' },
    { on: ['execution_id', 'product_id', 'type'], where: 'deleted_at IS NULL' },
]);
exports.default = exports.CatalogingSnapshot;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZ2luZy1zbmFwc2hvdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL21vZGVscy9jYXRhbG9naW5nLXNuYXBzaG90LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRCxnRUFBZ0U7QUFDbkQsUUFBQSxjQUFjLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFVLENBQUM7QUFJdkQ7Ozs7OztHQU1HO0FBQ1UsUUFBQSxrQkFBa0IsR0FBRyxhQUFLO0tBQ3BDLE1BQU0sQ0FBQyxxQkFBcUIsRUFBRTtJQUM3QixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUNoRCxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMxQixVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN4QixJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsc0JBQWMsQ0FBQyxDQUFDO0lBQ3JDLElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQzlCLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUNyRCxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUUsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0NBQzVFLENBQUMsQ0FBQztBQUVMLGtCQUFlLDBCQUFrQixDQUFDIn0=