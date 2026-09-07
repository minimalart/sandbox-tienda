"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeCommentsMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const validators_1 = require("./validators");
// GET /store/comments is public (just validates query). Writes require an
// authenticated customer (session or bearer).
exports.storeCommentsMiddlewares = [
    {
        matcher: '/store/comments',
        method: ['GET'],
        middlewares: [
            (0, http_1.validateAndTransformQuery)(validators_1.StoreListCommentsSchema, {
                isList: false,
            }),
        ],
    },
    {
        matcher: '/store/comments/eligibility',
        method: ['GET'],
        middlewares: [
            (0, http_1.authenticate)('customer', ['session', 'bearer']),
            (0, http_1.validateAndTransformQuery)(validators_1.StoreListCommentsSchema, {
                isList: false,
            }),
        ],
    },
    {
        matcher: '/store/comments',
        method: ['POST'],
        middlewares: [
            (0, http_1.authenticate)('customer', ['session', 'bearer']),
            (0, http_1.validateAndTransformBody)(validators_1.StoreCreateCommentSchema),
        ],
    },
    {
        matcher: '/store/comments/:id',
        method: ['PUT'],
        middlewares: [
            (0, http_1.authenticate)('customer', ['session', 'bearer']),
            (0, http_1.validateAndTransformBody)(validators_1.StoreUpdateCommentSchema),
        ],
    },
    {
        matcher: '/store/comments/:id',
        method: ['DELETE'],
        middlewares: [(0, http_1.authenticate)('customer', ['session', 'bearer'])],
    },
    {
        matcher: '/store/comments/:id/reply',
        method: ['POST'],
        middlewares: [
            (0, http_1.authenticate)('customer', ['session', 'bearer']),
            (0, http_1.validateAndTransformBody)(validators_1.StoreReplyCommentSchema),
        ],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NvbW1lbnRzL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1EQUtrQztBQUNsQyw2Q0FLc0I7QUFFdEIsMEVBQTBFO0FBQzFFLDhDQUE4QztBQUNqQyxRQUFBLHdCQUF3QixHQUFzQjtJQUN6RDtRQUNFLE9BQU8sRUFBRSxpQkFBaUI7UUFDMUIsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQ2YsV0FBVyxFQUFFO1lBQ1gsSUFBQSxnQ0FBeUIsRUFBQyxvQ0FBOEIsRUFBRTtnQkFDeEQsTUFBTSxFQUFFLEtBQUs7YUFDZCxDQUFDO1NBQ0g7S0FDRjtJQUNEO1FBQ0UsT0FBTyxFQUFFLDZCQUE2QjtRQUN0QyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUM7UUFDZixXQUFXLEVBQUU7WUFDWCxJQUFBLG1CQUFZLEVBQUMsVUFBVSxFQUFFLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQy9DLElBQUEsZ0NBQXlCLEVBQUMsb0NBQThCLEVBQUU7Z0JBQ3hELE1BQU0sRUFBRSxLQUFLO2FBQ2QsQ0FBQztTQUNIO0tBQ0Y7SUFDRDtRQUNFLE9BQU8sRUFBRSxpQkFBaUI7UUFDMUIsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRTtZQUNYLElBQUEsbUJBQVksRUFBQyxVQUFVLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDL0MsSUFBQSwrQkFBd0IsRUFBQyxxQ0FBK0IsQ0FBQztTQUMxRDtLQUNGO0lBQ0Q7UUFDRSxPQUFPLEVBQUUscUJBQXFCO1FBQzlCLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQztRQUNmLFdBQVcsRUFBRTtZQUNYLElBQUEsbUJBQVksRUFBQyxVQUFVLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDL0MsSUFBQSwrQkFBd0IsRUFBQyxxQ0FBK0IsQ0FBQztTQUMxRDtLQUNGO0lBQ0Q7UUFDRSxPQUFPLEVBQUUscUJBQXFCO1FBQzlCLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQztRQUNsQixXQUFXLEVBQUUsQ0FBQyxJQUFBLG1CQUFZLEVBQUMsVUFBVSxFQUFFLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7S0FDL0Q7SUFDRDtRQUNFLE9BQU8sRUFBRSwyQkFBMkI7UUFDcEMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRTtZQUNYLElBQUEsbUJBQVksRUFBQyxVQUFVLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDL0MsSUFBQSwrQkFBd0IsRUFBQyxvQ0FBOEIsQ0FBQztTQUN6RDtLQUNGO0NBQ0YsQ0FBQyJ9