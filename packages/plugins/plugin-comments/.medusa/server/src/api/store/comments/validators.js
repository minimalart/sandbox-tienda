"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreUpdateCommentSchema = exports.StoreReplyCommentSchema = exports.StoreCreateCommentSchema = exports.StoreListCommentsSchema = void 0;
const zod_1 = require("zod");
exports.StoreListCommentsSchema = zod_1.z.object({
    commentable_type: zod_1.z.enum(['product', 'blog_post']),
    commentable_id: zod_1.z.string().min(1),
});
exports.StoreCreateCommentSchema = zod_1.z.object({
    commentable_type: zod_1.z.enum(['product', 'blog_post']),
    commentable_id: zod_1.z.string().min(1),
    rating: zod_1.z.number().int().optional(),
    content: zod_1.z.string().optional(),
});
exports.StoreReplyCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
});
exports.StoreUpdateCommentSchema = zod_1.z.object({
    rating: zod_1.z.number().int().optional(),
    content: zod_1.z.string().optional(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvc3RvcmUvY29tbWVudHMvdmFsaWRhdG9ycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBd0I7QUFFWCxRQUFBLHVCQUF1QixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDOUMsZ0JBQWdCLEVBQUUsT0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNsRCxjQUFjLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Q0FDbEMsQ0FBQyxDQUFDO0FBR1UsUUFBQSx3QkFBd0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQy9DLGdCQUFnQixFQUFFLE9BQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDbEQsY0FBYyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLE1BQU0sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ25DLE9BQU8sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQy9CLENBQUMsQ0FBQztBQUdVLFFBQUEsdUJBQXVCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM5QyxPQUFPLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Q0FDM0IsQ0FBQyxDQUFDO0FBR1UsUUFBQSx3QkFBd0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQy9DLE1BQU0sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ25DLE9BQU8sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQy9CLENBQUMsQ0FBQyJ9