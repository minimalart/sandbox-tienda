"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogingOperation = exports.OPERATION_STATUSES = exports.OPERATION_TYPES = void 0;
const utils_1 = require("@medusajs/framework/utils");
/** Familia de operación elegida en el Paso 2 del wizard (PRD §12). */
exports.OPERATION_TYPES = [
    'text_field', // enriquecimiento textual mediante IA
    'image_technical', // procesamiento técnico determinístico de imágenes
    'image_ai', // generación/recreación de imágenes mediante IA
];
exports.OPERATION_STATUSES = ['pending', 'running', 'done', 'error'];
/**
 * CatalogingOperation — una operación (campo/transformación) seleccionada para
 * la ejecución (PRD §24). `field` identifica el campo de texto (p.ej.
 * 'description', 'meta_title', 'categories') o la operación de imagen
 * (p.ej. 'to_webp', 'lifestyle'). `configuration` guarda parámetros específicos.
 */
exports.CatalogingOperation = utils_1.model
    .define('cataloging_operation', {
    id: utils_1.model.id({ prefix: 'catop' }).primaryKey(),
    execution_id: utils_1.model.text(),
    type: utils_1.model.enum([...exports.OPERATION_TYPES]),
    field: utils_1.model.text(),
    configuration: utils_1.model.json().nullable(),
    status: utils_1.model.enum([...exports.OPERATION_STATUSES]).default('pending'),
})
    .indexes([{ on: ['execution_id'], where: 'deleted_at IS NULL' }]);
exports.default = exports.CatalogingOperation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZ2luZy1vcGVyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jYXRhbG9nYWRvci9tb2RlbHMvY2F0YWxvZ2luZy1vcGVyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxELHNFQUFzRTtBQUN6RCxRQUFBLGVBQWUsR0FBRztJQUM3QixZQUFZLEVBQUUsc0NBQXNDO0lBQ3BELGlCQUFpQixFQUFFLG1EQUFtRDtJQUN0RSxVQUFVLEVBQUUsZ0RBQWdEO0NBQ3BELENBQUM7QUFJRSxRQUFBLGtCQUFrQixHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFVLENBQUM7QUFHbkY7Ozs7O0dBS0c7QUFDVSxRQUFBLG1CQUFtQixHQUFHLGFBQUs7S0FDckMsTUFBTSxDQUFDLHNCQUFzQixFQUFFO0lBQzlCLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzlDLFlBQVksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQzFCLElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyx1QkFBZSxDQUFDLENBQUM7SUFDdEMsS0FBSyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDbkIsYUFBYSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDdEMsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLDBCQUFrQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO0NBQy9ELENBQUM7S0FDRCxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUVwRSxrQkFBZSwyQkFBbUIsQ0FBQyJ9