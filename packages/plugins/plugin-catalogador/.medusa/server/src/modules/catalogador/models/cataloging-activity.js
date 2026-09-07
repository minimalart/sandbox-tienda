"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogingActivity = exports.ACTIVITY_TYPES = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Tipos de evento de auditoría (PRD §21 "Actividad" / §32 "Auditoría").
 * No es un enum estricto para permitir eventos futuros sin migración.
 */
exports.ACTIVITY_TYPES = [
    'created',
    'generation_started',
    'generation_completed',
    'regenerated',
    'reviewed',
    'edited',
    'apply_started',
    'applied',
    'apply_failed',
    'cancelled',
    'restored',
    'refloated',
    'duplicated',
    'error',
];
/**
 * CatalogingActivity — registro append-only de acciones relevantes (PRD §32).
 * Anota usuario, fecha, producto/campo, acción, valores (anterior/propuesto/
 * aplicado) y herramienta/modelo usado en `metadata`.
 */
exports.CatalogingActivity = utils_1.model
    .define('cataloging_activity', {
    id: utils_1.model.id({ prefix: 'catact' }).primaryKey(),
    execution_id: utils_1.model.text(),
    execution_product_id: utils_1.model.text().nullable(),
    actor_id: utils_1.model.text().nullable(),
    type: utils_1.model.text(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['execution_id'], where: 'deleted_at IS NULL' },
    { on: ['execution_product_id'], where: 'deleted_at IS NULL' },
]);
exports.default = exports.CatalogingActivity;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZ2luZy1hY3Rpdml0eS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL21vZGVscy9jYXRhbG9naW5nLWFjdGl2aXR5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRDs7O0dBR0c7QUFDVSxRQUFBLGNBQWMsR0FBRztJQUM1QixTQUFTO0lBQ1Qsb0JBQW9CO0lBQ3BCLHNCQUFzQjtJQUN0QixhQUFhO0lBQ2IsVUFBVTtJQUNWLFFBQVE7SUFDUixlQUFlO0lBQ2YsU0FBUztJQUNULGNBQWM7SUFDZCxXQUFXO0lBQ1gsVUFBVTtJQUNWLFdBQVc7SUFDWCxZQUFZO0lBQ1osT0FBTztDQUNDLENBQUM7QUFFWDs7OztHQUlHO0FBQ1UsUUFBQSxrQkFBa0IsR0FBRyxhQUFLO0tBQ3BDLE1BQU0sQ0FBQyxxQkFBcUIsRUFBRTtJQUM3QixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUMvQyxZQUFZLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMxQixvQkFBb0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzdDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pDLElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ2xCLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2xDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUNyRCxFQUFFLEVBQUUsRUFBRSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0NBQzlELENBQUMsQ0FBQztBQUVMLGtCQUFlLDBCQUFrQixDQUFDIn0=