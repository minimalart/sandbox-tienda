"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminVimeoMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const validators_1 = require("./validators");
exports.adminVimeoMiddlewares = [
    {
        matcher: '/admin/vimeo/oauth/start',
        method: ['GET'],
        middlewares: [
            (0, http_1.validateAndTransformQuery)(validators_1.AdminVimeoOAuthStartQuery, {
                isList: false,
            }),
        ],
    },
    {
        matcher: '/admin/vimeo/oauth/callback',
        method: ['GET'],
        middlewares: [
            (0, http_1.validateAndTransformQuery)(validators_1.AdminVimeoOAuthCallbackQuery, {
                isList: false,
            }),
        ],
    },
    {
        matcher: '/admin/vimeo/upload',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.AdminVimeoUploadBody)],
    },
    {
        matcher: '/admin/vimeo/videos',
        method: ['GET'],
        middlewares: [
            (0, http_1.validateAndTransformQuery)(validators_1.AdminVimeoSearchQuery, {
                isList: false,
            }),
        ],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpbWVvL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1EQUlrQztBQUNsQyw2Q0FLc0I7QUFFVCxRQUFBLHFCQUFxQixHQUFzQjtJQUN0RDtRQUNFLE9BQU8sRUFBRSwwQkFBMEI7UUFDbkMsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQ2YsV0FBVyxFQUFFO1lBQ1gsSUFBQSxnQ0FBeUIsRUFBQyxzQ0FBZ0MsRUFBRTtnQkFDMUQsTUFBTSxFQUFFLEtBQUs7YUFDZCxDQUFDO1NBQ0g7S0FDRjtJQUNEO1FBQ0UsT0FBTyxFQUFFLDZCQUE2QjtRQUN0QyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUM7UUFDZixXQUFXLEVBQUU7WUFDWCxJQUFBLGdDQUF5QixFQUFDLHlDQUFtQyxFQUFFO2dCQUM3RCxNQUFNLEVBQUUsS0FBSzthQUNkLENBQUM7U0FDSDtLQUNGO0lBQ0Q7UUFDRSxPQUFPLEVBQUUscUJBQXFCO1FBQzlCLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLGlDQUEyQixDQUFDLENBQUM7S0FDckU7SUFDRDtRQUNFLE9BQU8sRUFBRSxxQkFBcUI7UUFDOUIsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQ2YsV0FBVyxFQUFFO1lBQ1gsSUFBQSxnQ0FBeUIsRUFBQyxrQ0FBNEIsRUFBRTtnQkFDdEQsTUFBTSxFQUFFLEtBQUs7YUFDZCxDQUFDO1NBQ0g7S0FDRjtDQUNGLENBQUMifQ==