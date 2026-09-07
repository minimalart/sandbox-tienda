"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storePointsMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
// All points routes operate on the authenticated customer's own account.
exports.storePointsMiddlewares = [
    {
        matcher: '/store/points',
        middlewares: [(0, http_1.authenticate)('customer', ['session', 'bearer'])],
    },
    {
        matcher: '/store/points/*',
        middlewares: [(0, http_1.authenticate)('customer', ['session', 'bearer'])],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3BvaW50cy9taWRkbGV3YXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtREFBeUU7QUFFekUseUVBQXlFO0FBQzVELFFBQUEsc0JBQXNCLEdBQXNCO0lBQ3ZEO1FBQ0UsT0FBTyxFQUFFLGVBQWU7UUFDeEIsV0FBVyxFQUFFLENBQUMsSUFBQSxtQkFBWSxFQUFDLFVBQVUsRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0tBQy9EO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsaUJBQWlCO1FBQzFCLFdBQVcsRUFBRSxDQUFDLElBQUEsbUJBQVksRUFBQyxVQUFVLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUMvRDtDQUNGLENBQUMifQ==