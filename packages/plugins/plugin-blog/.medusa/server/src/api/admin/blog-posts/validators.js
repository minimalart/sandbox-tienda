"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostAdminSetBlogPostProducts = exports.PostAdminUpdateBlogPost = exports.PostAdminCreateBlogPost = void 0;
const zod_1 = require("zod");
const statusSchema = zod_1.z.enum(['draft', 'published']);
// URL-safe slug: lowercase words separated by single hyphens.
const slugSchema = zod_1.z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (a-z, 0-9, hyphens)');
const imageSchema = zod_1.z
    .object({
    url: zod_1.z.string(),
    file_id: zod_1.z.string().optional().nullable(),
    alt: zod_1.z.string().optional().nullable(),
})
    .passthrough();
// Tiptap document — kept permissive (passthrough) so editor upgrades don't
// break persistence; the renderer maps known nodes only.
const contentSchema = zod_1.z
    .object({
    type: zod_1.z.string().optional(),
    content: zod_1.z.array(zod_1.z.any()).optional(),
})
    .passthrough();
exports.PostAdminCreateBlogPost = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').trim(),
    slug: slugSchema.optional(),
    excerpt: zod_1.z.string().optional().nullable(),
    cover_image: imageSchema.optional().nullable(),
    content: contentSchema.optional().nullable(),
    status: statusSchema.optional(),
    category_id: zod_1.z.string().optional().nullable(),
    seo_title: zod_1.z.string().optional().nullable(),
    seo_description: zod_1.z.string().optional().nullable(),
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).nullish(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().nullable(),
});
exports.PostAdminUpdateBlogPost = zod_1.z.object({
    title: zod_1.z.string().min(1).trim().optional(),
    slug: slugSchema.optional(),
    excerpt: zod_1.z.string().optional().nullable(),
    cover_image: imageSchema.optional().nullable(),
    content: contentSchema.optional().nullable(),
    status: statusSchema.optional(),
    category_id: zod_1.z.string().optional().nullable(),
    seo_title: zod_1.z.string().optional().nullable(),
    seo_description: zod_1.z.string().optional().nullable(),
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).nullish(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().nullable(),
});
exports.PostAdminSetBlogPostProducts = zod_1.z.object({
    product_ids: zod_1.z.array(zod_1.z.string()),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vYmxvZy1wb3N0cy92YWxpZGF0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZCQUF3QjtBQUV4QixNQUFNLFlBQVksR0FBRyxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFFcEQsOERBQThEO0FBQzlELE1BQU0sVUFBVSxHQUFHLE9BQUM7S0FDakIsTUFBTSxFQUFFO0tBQ1IsS0FBSyxDQUFDLDRCQUE0QixFQUFFLDJDQUEyQyxDQUFDLENBQUM7QUFFcEYsTUFBTSxXQUFXLEdBQUcsT0FBQztLQUNsQixNQUFNLENBQUM7SUFDTixHQUFHLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNmLE9BQU8sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLEdBQUcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ3RDLENBQUM7S0FDRCxXQUFXLEVBQUUsQ0FBQztBQUVqQiwyRUFBMkU7QUFDM0UseURBQXlEO0FBQ3pELE1BQU0sYUFBYSxHQUFHLE9BQUM7S0FDcEIsTUFBTSxDQUFDO0lBQ04sSUFBSSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDM0IsT0FBTyxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMsT0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0NBQ3JDLENBQUM7S0FDRCxXQUFXLEVBQUUsQ0FBQztBQUVKLFFBQUEsdUJBQXVCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM5QyxLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVB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