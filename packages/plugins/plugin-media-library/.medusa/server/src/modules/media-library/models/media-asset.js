"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaAsset = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Asset del catálogo de la Biblioteca. Registra un archivo ya subido al File
 * Module (S3): su `url` pública + `file_id` del provider. Reutilizable para
 * adjuntar a productos sin volver a subir.
 */
exports.MediaAsset = utils_1.model
    .define('media_asset', {
    id: utils_1.model.id({ prefix: 'media' }).primaryKey(),
    file_id: utils_1.model.text().nullable(),
    url: utils_1.model.text(),
    filename: utils_1.model.text(),
    mime_type: utils_1.model.text().nullable(),
    size: utils_1.model.number().nullable(),
    alt: utils_1.model.text().nullable(),
    title: utils_1.model.text().nullable(),
    // 'upload' | 'backfill:product'
    source: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([{ on: ['filename'] }, { on: ['file_id'] }, { on: ['url'] }]);
exports.default = exports.MediaAsset;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkaWEtYXNzZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9tZWRpYS1saWJyYXJ5L21vZGVscy9tZWRpYS1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFbEQ7Ozs7R0FJRztBQUNVLFFBQUEsVUFBVSxHQUFHLGFBQUs7S0FDNUIsTUFBTSxDQUFDLGFBQWEsRUFBRTtJQUNyQixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM5QyxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNoQyxHQUFHLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNqQixRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN0QixTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxJQUFJLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMvQixHQUFHLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QixLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM5QixnQ0FBZ0M7SUFDaEMsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0IsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDbEMsQ0FBQztLQUNELE9BQU8sQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUV6RSxrQkFBZSxrQkFBVSxDQUFDIn0=