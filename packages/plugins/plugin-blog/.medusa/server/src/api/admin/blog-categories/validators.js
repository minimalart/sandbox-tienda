"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostAdminUpdateBlogCategory = exports.PostAdminCreateBlogCategory = void 0;
const zod_1 = require("zod");
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
exports.PostAdminCreateBlogCategory = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').trim(),
    slug: slugSchema.optional(),
    description: zod_1.z.string().optional().nullable(),
    image: imageSchema.optional().nullable(),
    sort_order: zod_1.z.number().int().optional(),
});
exports.PostAdminUpdateBlogCategory = zod_1.z.object({
    name: zod_1.z.string().min(1).trim().optional(),
    slug: slugSchema.optional(),
    description: zod_1.z.string().optional().nullable(),
    image: imageSchema.optional().nullable(),
    sort_order: zod_1.z.number().int().optional(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vYmxvZy1jYXRlZ29yaWVzL3ZhbGlkYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkJBQXdCO0FBRXhCLE1BQU0sVUFBVSxHQUFHLE9BQUM7S0FDakIsTUFBTSxFQUFFO0tBQ1IsS0FBSyxDQUFDLDRCQUE0QixFQUFFLDJDQUEyQyxDQUFDLENBQUM7QUFFcEYsTUFBTSxXQUFXLEdBQUcsT0FBQztLQUNsQixNQUFNLENBQUM7SUFDTixHQUFHLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNmLE9BQU8sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLEdBQUcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ3RDLENBQUM7S0FDRCxXQUFXLEVBQUUsQ0FBQztBQUVKLFFBQUEsMkJBQTJCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNsRCxJQUFJLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxJQUFJLEVBQUU7SUFDbEQsSUFBSSxFQUFFLFVBQVUsQ0FBQyxRQUFRLEVBQUU7SUFDM0IsV0FBVyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0MsS0FBSyxFQUFFLFdBQVcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDeEMsVUFBVSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDeEMsQ0FBQyxDQUFDO0FBRVUsUUFBQSwyQkFBMkIsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ2xELElBQUksRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN6QyxJQUFJLEVBQUUsVUFBVSxDQUFDLFFBQVEsRUFBRTtJQUMzQixXQUFXLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM3QyxLQUFLLEVBQUUsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN4QyxVQUFVLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUN4QyxDQUFDLENBQUMifQ==