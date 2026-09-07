"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminShopByLooksMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const route_1 = require("./[look_id]/route");
const route_2 = require("./route");
exports.adminShopByLooksMiddlewares = [
    {
        matcher: '/admin/shop-by-looks',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_2.CreateShopByLookSchema)],
    },
    {
        matcher: '/admin/shop-by-looks/:look_id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_1.UpdateShopByLookSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3Nob3AtYnktbG9va3MvbWlkZGxld2FyZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbURBQXFGO0FBQ3JGLDZDQUEyRDtBQUMzRCxtQ0FBaUQ7QUFFcEMsUUFBQSwyQkFBMkIsR0FBc0I7SUFDNUQ7UUFDRSxPQUFPLEVBQUUsc0JBQXNCO1FBQy9CLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLDhCQUFzQixDQUFDLENBQUM7S0FDaEU7SUFDRDtRQUNFLE9BQU8sRUFBRSwrQkFBK0I7UUFDeEMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsOEJBQXNCLENBQUMsQ0FBQztLQUNoRTtDQUNGLENBQUMifQ==