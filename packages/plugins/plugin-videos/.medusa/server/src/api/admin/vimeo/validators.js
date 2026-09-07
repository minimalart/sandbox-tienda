"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminVimeoSearchQuery = exports.AdminVimeoUploadBody = exports.AdminVimeoOAuthCallbackQuery = exports.AdminVimeoOAuthStartQuery = void 0;
const zod_1 = require("zod");
exports.AdminVimeoOAuthStartQuery = zod_1.z.object({
    redirect_to: zod_1.z.string().optional(),
});
exports.AdminVimeoOAuthCallbackQuery = zod_1.z.object({
    code: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    error: zod_1.z.string().optional(),
    error_description: zod_1.z.string().optional(),
});
exports.AdminVimeoUploadBody = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    file_size: zod_1.z.number().optional(),
});
exports.AdminVimeoSearchQuery = zod_1.z.object({
    query: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().optional(),
    per_page: zod_1.z.coerce.number().optional(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vdmltZW8vdmFsaWRhdG9ycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBd0I7QUFFWCxRQUFBLHlCQUF5QixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDaEQsV0FBVyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDbkMsQ0FBQyxDQUFDO0FBSVUsUUFBQSw0QkFBNEIsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ25ELElBQUksRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzNCLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzVCLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzVCLGlCQUFpQixFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDekMsQ0FBQyxDQUFDO0FBSVUsUUFBQSxvQkFBb0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzNDLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFO0lBQ2pCLFdBQVcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLFNBQVMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2pDLENBQUMsQ0FBQztBQUlVLFFBQUEscUJBQXFCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM1QyxLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QixJQUFJLEVBQUUsT0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ3ZDLENBQUMsQ0FBQyJ9