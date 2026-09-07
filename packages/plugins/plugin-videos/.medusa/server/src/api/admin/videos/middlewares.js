"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminVideosMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const validators_1 = require("./validators");
exports.adminVideosMiddlewares = [
    {
        matcher: '/admin/videos',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.AdminCreateVideoSchema)],
    },
    {
        matcher: '/admin/videos/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.AdminUpdateVideoSchema)],
    },
    {
        matcher: '/admin/videos/:id/products',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.AdminLinkProductsSchema)],
    },
    {
        matcher: '/admin/videos/:id/products',
        method: ['DELETE'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.AdminUnlinkProductsSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpZGVvcy9taWRkbGV3YXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtREFBcUY7QUFDckYsNkNBS3NCO0FBRVQsUUFBQSxzQkFBc0IsR0FBc0I7SUFDdkQ7UUFDRSxPQUFPLEVBQUUsZUFBZTtRQUN4QixNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyxtQ0FBNkIsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsbUJBQW1CO1FBQzVCLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLG1DQUE2QixDQUFDLENBQUM7S0FDdkU7SUFDRDtRQUNFLE9BQU8sRUFBRSw0QkFBNEI7UUFDckMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsb0NBQThCLENBQUMsQ0FBQztLQUN4RTtJQUNEO1FBQ0UsT0FBTyxFQUFFLDRCQUE0QjtRQUNyQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUM7UUFDbEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyxzQ0FBZ0MsQ0FBQyxDQUFDO0tBQzFFO0NBQ0YsQ0FBQyJ9