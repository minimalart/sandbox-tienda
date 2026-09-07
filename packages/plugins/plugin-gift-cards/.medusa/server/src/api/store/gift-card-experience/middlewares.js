"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeGiftCardExperienceMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
exports.storeGiftCardExperienceMiddlewares = [
    {
        matcher: '/store/gift-card-experience/landing/*/claim',
        middlewares: [(0, http_1.authenticate)('customer', ['session', 'bearer'])],
    },
    {
        matcher: '/store/gift-card-experience/wallet',
        middlewares: [(0, http_1.authenticate)('customer', ['session', 'bearer'])],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2dpZnQtY2FyZC1leHBlcmllbmNlL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1EQUE4RTtBQUVqRSxRQUFBLGtDQUFrQyxHQUFzQjtJQUNuRTtRQUNFLE9BQU8sRUFBRSw2Q0FBNkM7UUFDdEQsV0FBVyxFQUFFLENBQUMsSUFBQSxtQkFBWSxFQUFDLFVBQVUsRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0tBQy9EO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsb0NBQW9DO1FBQzdDLFdBQVcsRUFBRSxDQUFDLElBQUEsbUJBQVksRUFBQyxVQUFVLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUMvRDtDQUNGLENBQUMifQ==