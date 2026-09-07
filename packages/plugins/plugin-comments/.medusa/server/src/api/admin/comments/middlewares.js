"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCommentsMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const validators_1 = require("./validators");
// /admin/* already gets admin auth from the framework. We only add validation.
exports.adminCommentsMiddlewares = [
    {
        matcher: '/admin/comments',
        method: ['GET'],
        middlewares: [
            (0, http_1.validateAndTransformQuery)(validators_1.AdminListCommentsSchema, {
                isList: true,
            }),
        ],
    },
    {
        matcher: '/admin/comments/settings',
        method: ['POST'],
        middlewares: [
            (0, http_1.validateAndTransformBody)(validators_1.AdminUpdateCommentSettingsSchema),
        ],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lbnRzL21pZGRsZXdhcmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1EQUlrQztBQUNsQyw2Q0FHc0I7QUFFdEIsK0VBQStFO0FBQ2xFLFFBQUEsd0JBQXdCLEdBQXNCO0lBQ3pEO1FBQ0UsT0FBTyxFQUFFLGlCQUFpQjtRQUMxQixNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUM7UUFDZixXQUFXLEVBQUU7WUFDWCxJQUFBLGdDQUF5QixFQUFDLG9DQUE4QixFQUFFO2dCQUN4RCxNQUFNLEVBQUUsSUFBSTthQUNiLENBQUM7U0FDSDtLQUNGO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsMEJBQTBCO1FBQ25DLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUU7WUFDWCxJQUFBLCtCQUF3QixFQUFDLDZDQUF1QyxDQUFDO1NBQ2xFO0tBQ0Y7Q0FDRixDQUFDIn0=