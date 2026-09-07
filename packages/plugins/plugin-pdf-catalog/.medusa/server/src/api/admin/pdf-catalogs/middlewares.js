"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPdfCatalogsMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const route_1 = require("./[id]/route");
const route_2 = require("./route");
exports.adminPdfCatalogsMiddlewares = [
    {
        matcher: '/admin/pdf-catalogs',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_2.CreatePdfCatalogSchema)],
    },
    {
        matcher: '/admin/pdf-catalogs/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_1.UpdatePdfCatalogSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3BkZi1jYXRhbG9ncy9taWRkbGV3YXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtREFBcUY7QUFDckYsd0NBQXNEO0FBQ3RELG1DQUFpRDtBQUVwQyxRQUFBLDJCQUEyQixHQUFzQjtJQUM1RDtRQUNFLE9BQU8sRUFBRSxxQkFBcUI7UUFDOUIsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsOEJBQXNCLENBQUMsQ0FBQztLQUNoRTtJQUNEO1FBQ0UsT0FBTyxFQUFFLHlCQUF5QjtRQUNsQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyw4QkFBc0IsQ0FBQyxDQUFDO0tBQ2hFO0NBQ0YsQ0FBQyJ9