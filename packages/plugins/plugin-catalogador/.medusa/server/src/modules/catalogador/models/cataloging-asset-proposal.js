"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogingAssetProposal = exports.ASSET_PROPOSAL_STATUSES = exports.ASSET_OPERATION_TYPES = void 0;
const utils_1 = require("@medusajs/framework/utils");
/** Tipo de operación de imagen que originó la propuesta (PRD §12.2 / §12.3). */
exports.ASSET_OPERATION_TYPES = [
    // Técnicas (determinísticas). `optimize` es el resultado combinado de las
    // técnicas seleccionadas: UNA versión optimizada que REEMPLAZA la imagen
    // original (no suma copias).
    'optimize',
    'to_webp',
    'compress',
    'resize',
    'normalize',
    // IA
    'recreate', // recreación/estandarización (fondo blanco)
    'lifestyle', // escena lifestyle
    'lifestyle_editable', // escena lifestyle con ajuste manual de posición/escala
    'background', // fondo configurado
    'generate_missing', // generar principal faltante
    'variation', // variación de una imagen existente
    'import_external', // imagen real encontrada en la web, importada tal cual (no IA)
];
exports.ASSET_PROPOSAL_STATUSES = [
    'pending',
    'proposed',
    'accepted',
    'rejected',
    'applied',
    'error',
];
/**
 * CatalogingAssetProposal — una propuesta de imagen (procesada o generada) para
 * un producto de la ejecución (PRD §24). Conserva referencia al asset original
 * y al generado; NUNCA reemplaza la imagen existente antes de la aprobación
 * (PRD §12.3). Las imágenes generadas se marcan como contenido generado.
 */
exports.CatalogingAssetProposal = utils_1.model
    .define('cataloging_asset_proposal', {
    id: utils_1.model.id({ prefix: 'catasset' }).primaryKey(),
    execution_product_id: utils_1.model.text(),
    source_asset_id: utils_1.model.text().nullable(), // File/media id o URL de origen
    generated_asset_id: utils_1.model.text().nullable(), // File/media id resultante
    operation_type: utils_1.model.enum([...exports.ASSET_OPERATION_TYPES]),
    status: utils_1.model.enum([...exports.ASSET_PROPOSAL_STATUSES]).default('pending'),
    is_ai_generated: utils_1.model.boolean().default(false),
    metadata: utils_1.model.json().nullable(), // peso/dim antes-después, prompt ref, etc.
    generation_provider: utils_1.model.text().nullable(),
    generation_model: utils_1.model.text().nullable(),
})
    .indexes([{ on: ['execution_product_id'], where: 'deleted_at IS NULL' }]);
exports.default = exports.CatalogingAssetProposal;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZ2luZy1hc3NldC1wcm9wb3NhbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL21vZGVscy9jYXRhbG9naW5nLWFzc2V0LXByb3Bvc2FsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRCxnRkFBZ0Y7QUFDbkUsUUFBQSxxQkFBcUIsR0FBRztJQUNuQywwRUFBMEU7SUFDMUUseUVBQXlFO0lBQ3pFLDZCQUE2QjtJQUM3QixVQUFVO0lBQ1YsU0FBUztJQUNULFVBQVU7SUFDVixRQUFRO0lBQ1IsV0FBVztJQUNYLEtBQUs7SUFDTCxVQUFVLEVBQUUsNENBQTRDO0lBQ3hELFdBQVcsRUFBRSxtQkFBbUI7SUFDaEMsb0JBQW9CLEVBQUUsd0RBQXdEO0lBQzlFLFlBQVksRUFBRSxvQkFBb0I7SUFDbEMsa0JBQWtCLEVBQUUsNkJBQTZCO0lBQ2pELFdBQVcsRUFBRSxvQ0FBb0M7SUFDakQsaUJBQWlCLEVBQUUsK0RBQStEO0NBQzFFLENBQUM7QUFJRSxRQUFBLHVCQUF1QixHQUFHO0lBQ3JDLFNBQVM7SUFDVCxVQUFVO0lBQ1YsVUFBVTtJQUNWLFVBQVU7SUFDVixTQUFTO0lBQ1QsT0FBTztDQUNDLENBQUM7QUFFWDs7Ozs7R0FLRztBQUNVLFFBQUEsdUJBQXVCLEdBQUcsYUFBSztLQUN6QyxNQUFNLENBQUMsMkJBQTJCLEVBQUU7SUFDbkMsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDakQsb0JBQW9CLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQyxlQUFlLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFLGdDQUFnQztJQUMxRSxrQkFBa0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLEVBQUUsMkJBQTJCO0lBQ3hFLGNBQWMsRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyw2QkFBcUIsQ0FBQyxDQUFDO0lBQ3RELE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRywrQkFBdUIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztJQUNuRSxlQUFlLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDL0MsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRSwyQ0FBMkM7SUFDOUUsbUJBQW1CLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QyxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQzFDLENBQUM7S0FDRCxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRTVFLGtCQUFlLCtCQUF1QixDQUFDIn0=