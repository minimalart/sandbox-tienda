"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const zod_1 = require("zod");
const blog_1 = require("../../../modules/blog");
const request_1 = require("../../../lib/multistore/request");
/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req) => {
    const resolution = await (0, request_1.siteFromRequest)(req);
    return resolution.status === 'site' ? resolution.site.id : null;
};
const UpdateBlogSettings = zod_1.z.object({
    section_name: zod_1.z.string().min(1).optional(),
    show_search: zod_1.z.boolean().optional(),
    show_categories: zod_1.z.boolean().optional(),
    posts_per_page: zod_1.z.number().int().min(1).max(100).optional(),
    default_seo_title: zod_1.z.string().optional().nullable(),
    default_seo_description: zod_1.z.string().optional().nullable(),
});
/** GET /admin/blog-settings — singleton config (created with defaults on first read). */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const blog_settings = await service.getSettings(await siteOf(req));
        return res.status(200).json({ blog_settings });
    }
    catch (error) {
        console.error('[Admin BlogSettings] Error reading settings:', error);
        return res.status(500).json({ message: 'Error fetching blog settings' });
    }
}
/** POST /admin/blog-settings — update the singleton config. */
async function POST(req, res) {
    try {
        const validated = UpdateBlogSettings.parse(req.body);
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        // Ver la nota de comments/settings: actualizar la fila que devolvió el GET
        // escribiría la configuración global cuando la tienda no tiene la suya.
        const blog_settings = await service.upsertSettingsForSite(await siteOf(req), validated);
        return res.status(200).json({ blog_settings });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error updating blog settings';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctc2V0dGluZ3Mvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF3QkEsa0JBU0M7QUFHRCxvQkFhQztBQWhERCw2QkFBd0I7QUFDeEIsZ0RBQW9EO0FBR3BELDZEQUFrRTtBQUdsRSw2RUFBNkU7QUFDN0UsTUFBTSxNQUFNLEdBQUcsS0FBSyxFQUFFLEdBQWtCLEVBQTBCLEVBQUU7SUFDbEUsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUMsT0FBTyxVQUFVLENBQUMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNsRSxDQUFDLENBQUM7QUFFRixNQUFNLGtCQUFrQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDbEMsWUFBWSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQzFDLFdBQVcsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ25DLGVBQWUsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3ZDLGNBQWMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDM0QsaUJBQWlCLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuRCx1QkFBdUIsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQzFELENBQUMsQ0FBQztBQUVILHlGQUF5RjtBQUNsRixLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztRQUNsRSxNQUFNLGFBQWEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxXQUFXLENBQUMsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsOENBQThDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxDQUFDLENBQUM7SUFDM0UsQ0FBQztBQUNILENBQUM7QUFFRCwrREFBK0Q7QUFDeEQsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sU0FBUyxHQUFHLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckQsTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztRQUNsRSwyRUFBMkU7UUFDM0Usd0VBQXdFO1FBQ3hFLE1BQU0sYUFBYSxHQUFHLE1BQU0sT0FBTyxDQUFDLHFCQUFxQixDQUFDLE1BQU0sTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFNBQW9DLENBQUMsQ0FBQztRQUNuSCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUNYLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDhCQUE4QixDQUFDO1FBQzFFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=