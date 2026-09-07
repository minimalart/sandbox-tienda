"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeLoyaltyMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const validators_1 = require("./validators");
// All loyalty store routes operate on the authenticated customer.
exports.storeLoyaltyMiddlewares = [
    {
        matcher: '/store/loyalty/*',
        middlewares: [(0, http_1.authenticate)('customer', ['session', 'bearer'])],
    },
    {
        matcher: '/store/loyalty/redeem',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.RedeemSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2xveWFsdHkvbWlkZGxld2FyZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbURBQXdHO0FBQ3hHLDZDQUE0QztBQUU1QyxrRUFBa0U7QUFDckQsUUFBQSx1QkFBdUIsR0FBc0I7SUFDeEQ7UUFDRSxPQUFPLEVBQUUsa0JBQWtCO1FBQzNCLFdBQVcsRUFBRSxDQUFDLElBQUEsbUJBQVksRUFBQyxVQUFVLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUMvRDtJQUNEO1FBQ0UsT0FBTyxFQUFFLHVCQUF1QjtRQUNoQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyx5QkFBWSxDQUFDLENBQUM7S0FDdEQ7Q0FDRixDQUFDIn0=