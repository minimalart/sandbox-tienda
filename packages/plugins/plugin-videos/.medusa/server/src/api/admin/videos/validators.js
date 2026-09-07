"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUnlinkProductsSchema = exports.AdminLinkProductsSchema = exports.AdminUpdateVideoSchema = exports.AdminCreateVideoSchema = void 0;
const zod_1 = require("zod");
exports.AdminCreateVideoSchema = zod_1.z.object({
    vimeo_id: zod_1.z.string(),
    vimeo_uri: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    thumbnail_url: zod_1.z.string().optional(),
    poster_url: zod_1.z.string().nullable().optional(),
    vimeo_url: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional(),
    status: zod_1.z
        .enum([
        'uploading',
        'transcoding',
        'processing',
        'available',
        'error',
        'quota_exceeded',
        'total_cap_exceeded',
        'transcode_starting',
        'unavailable',
    ])
        .optional(),
    is_active: zod_1.z.boolean().optional(),
    show_in_carousel: zod_1.z.boolean().optional(),
    sort_order: zod_1.z.number().optional(),
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).nullish(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.AdminUpdateVideoSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    thumbnail_url: zod_1.z.string().optional(),
    poster_url: zod_1.z.string().nullable().optional(),
    vimeo_url: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional(),
    status: zod_1.z
        .enum([
        'uploading',
        'transcoding',
        'processing',
        'available',
        'error',
        'quota_exceeded',
        'total_cap_exceeded',
        'transcode_starting',
        'unavailable',
    ])
        .optional(),
    is_active: zod_1.z.boolean().optional(),
    show_in_carousel: zod_1.z.boolean().optional(),
    sort_order: zod_1.z.number().optional(),
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).nullish(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.AdminLinkProductsSchema = zod_1.z.object({
    product_ids: zod_1.z.array(zod_1.z.string()),
});
exports.AdminUnlinkProductsSchema = zod_1.z.object({
    product_ids: zod_1.z.array(zod_1.z.string()),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vdmlkZW9zL3ZhbGlkYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkJBQXdCO0FBRVgsUUFBQSxzQkFBc0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzdDLFFBQVEsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFO0lBQ3BCLFNBQVMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFO0lBQ3JCLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFO0lBQ2pCLFdBQVcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLGFBQWEsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLFVBQVUsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzVDLFNBQVMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hDLFFBQVEsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQy9CLE1BQU0sRUFBRSxPQUFDO1NBQ04sSUFBSSxDQUFDO1FBQ0osV0FBVztRQUNYLGFBQWE7UUFDYixZQUFZO1FBQ1osV0FBVztRQUNYLE9BQU87UUFDUCxnQkFBZ0I7UUFDaEIsb0JBQW9CO1FBQ3BCLG9CQUFvQjtRQUNwQixhQUFhO0tBQ2QsQ0FBQztTQUNELFFBQVEsRUFBRTtJQUNiLFNBQVMsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pDLGdCQUFnQixFQUFFLE9BQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDeEMsVUFBVSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsaUJBQWlCLEVBQUUsT0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUU7SUFDaEQsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRTtDQUNuRCxDQUFDLENBQUM7QUFJVSxRQUFBLHNCQUFzQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDN0MsS0FBSyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDNUIsV0FBVyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsYUFBYSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsVUFBVSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDNUMsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDaEMsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0IsTUFBTSxFQUFFLE9BQUM7U0FDTixJQUFJLENBQUM7UUFDSixXQUFXO1FBQ1gsYUFBYTtRQUNiLFlBQVk7UUFDWixXQUFXO1FBQ1gsT0FBTztRQUNQLGdCQUFnQjtRQUNoQixvQkFBb0I7UUFDcEIsb0JBQW9CO1FBQ3BCLGFBQWE7S0FDZCxDQUFDO1NBQ0QsUUFBUSxFQUFFO0lBQ2IsU0FBUyxFQUFFLE9BQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsZ0JBQWdCLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN4QyxVQUFVLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQyxpQkFBaUIsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRTtJQUNoRCxRQUFRLEVBQUUsT0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0NBQ25ELENBQUMsQ0FBQztBQUlVLFFBQUEsdUJBQXVCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM5QyxXQUFXLEVBQUUsT0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7Q0FDakMsQ0FBQyxDQUFDO0FBSVUsUUFBQSx5QkFBeUIsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ2hELFdBQVcsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztDQUNqQyxDQUFDLENBQUMifQ==