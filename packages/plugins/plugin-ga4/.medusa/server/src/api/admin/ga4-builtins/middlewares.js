"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGa4BuiltinsMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const route_1 = require("./[key]/route");
exports.adminGa4BuiltinsMiddlewares = [
    {
        matcher: '/admin/ga4-builtins/:key',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_1.UpdateGa4BuiltinSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dhNC1idWlsdGlucy9taWRkbGV3YXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtREFBcUY7QUFDckYseUNBQXVEO0FBRTFDLFFBQUEsMkJBQTJCLEdBQXNCO0lBQzVEO1FBQ0UsT0FBTyxFQUFFLDBCQUEwQjtRQUNuQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyw4QkFBc0IsQ0FBQyxDQUFDO0tBQ2hFO0NBQ0YsQ0FBQyJ9