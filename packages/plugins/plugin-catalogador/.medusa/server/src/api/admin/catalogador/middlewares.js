"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCatalogadorMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const route_1 = require("./config/route");
const route_2 = require("./executions/route");
const route_3 = require("./executions/[id]/route");
const route_4 = require("./selection/preview/route");
const route_5 = require("./executions/[id]/generate/route");
const route_6 = require("./executions/[id]/products/[pid]/route");
const route_7 = require("./executions/[id]/assets/[aid]/composition/route");
/**
 * Validación de bodies del Catalogador. Se agregan en
 * apps/backend/src/api/extension-middlewares.ts (generado por el composer a
 * partir de extension-integrations.js). La autenticación admin la aplica Medusa
 * por el prefijo /admin.
 */
exports.adminCatalogadorMiddlewares = [
    {
        matcher: '/admin/catalogador/config',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_1.CatalogadorConfigSchema)],
    },
    {
        matcher: '/admin/catalogador/executions',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_2.CreateExecutionSchema)],
    },
    {
        matcher: '/admin/catalogador/executions/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_3.UpdateExecutionSchema)],
    },
    {
        matcher: '/admin/catalogador/executions/:id/generate',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_5.GenerateExecutionSchema)],
    },
    {
        matcher: '/admin/catalogador/executions/:id/products/:pid',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_6.ReviewProductSchema)],
    },
    {
        matcher: '/admin/catalogador/executions/:id/assets/:aid/composition',
        method: ['PATCH'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_7.UpdateCompositionSchema)],
    },
    {
        matcher: '/admin/catalogador/selection/preview',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_4.SelectionPreviewSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1EQUFxRjtBQUNyRiwwQ0FBeUQ7QUFDekQsOENBQTJEO0FBQzNELG1EQUFnRTtBQUNoRSxxREFBbUU7QUFDbkUsNERBQTJFO0FBQzNFLGtFQUE2RTtBQUM3RSw0RUFBMkY7QUFFM0Y7Ozs7O0dBS0c7QUFDVSxRQUFBLDJCQUEyQixHQUFzQjtJQUM1RDtRQUNFLE9BQU8sRUFBRSwyQkFBMkI7UUFDcEMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsK0JBQXVCLENBQUMsQ0FBQztLQUNqRTtJQUNEO1FBQ0UsT0FBTyxFQUFFLCtCQUErQjtRQUN4QyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyw2QkFBcUIsQ0FBQyxDQUFDO0tBQy9EO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsbUNBQW1DO1FBQzVDLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLDZCQUFxQixDQUFDLENBQUM7S0FDL0Q7SUFDRDtRQUNFLE9BQU8sRUFBRSw0Q0FBNEM7UUFDckQsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsK0JBQXVCLENBQUMsQ0FBQztLQUNqRTtJQUNEO1FBQ0UsT0FBTyxFQUFFLGlEQUFpRDtRQUMxRCxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQywyQkFBbUIsQ0FBQyxDQUFDO0tBQzdEO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsMkRBQTJEO1FBQ3BFLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQztRQUNqQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLCtCQUF1QixDQUFDLENBQUM7S0FDakU7SUFDRDtRQUNFLE9BQU8sRUFBRSxzQ0FBc0M7UUFDL0MsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsOEJBQXNCLENBQUMsQ0FBQztLQUNoRTtDQUNGLENBQUMifQ==