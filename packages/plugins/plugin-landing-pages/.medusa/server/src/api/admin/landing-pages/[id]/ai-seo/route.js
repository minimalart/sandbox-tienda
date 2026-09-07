"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const zod_1 = require("zod");
const landing_page_1 = require("../../../../../modules/landing-page");
const foreign_modules_1 = require("../../../../../lib/foreign-modules");
const generator_1 = require("../../../../../modules/landing-page/ai/generator");
const puck_schema_1 = require("../../../../../modules/landing-page/ai/puck-schema");
const types_1 = require("../../../../../modules/landing-page/ai/types");
const BodySchema = zod_1.z.object({
    locale: zod_1.z.string().optional(),
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * POST /admin/landing-pages/:id/ai-seo
 * Genera title/description/image/noindex y los guarda en `seo`.
 */
async function POST(req, res) {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
    }
    const service = req.scope.resolve(landing_page_1.LANDING_PAGE_MODULE);
    let landing;
    try {
        landing = (await service.retrieveLandingPage(req.params.id));
    }
    catch {
        return res.status(404).json({ message: 'Landing page no encontrada' });
    }
    try {
        const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
        const ai = await storeConfig.getAiConfig();
        const seo = await (0, generator_1.generateLandingSeo)({
            title: landing.title,
            locale: parsed.data.locale,
            keywords: parsed.data.keywords,
            currentPuckData: (0, puck_schema_1.sanitizePuckData)(landing.puck_data),
        }, { model: ai.text_model });
        await service.updateLandingPages({ id: landing.id, seo });
        const landing_page = await service.retrieveLandingPage(landing.id);
        return res.status(200).json({ landing_page, seo, saved: true });
    }
    catch (error) {
        if (error instanceof types_1.LandingAiError) {
            return res.status(error.status).json({ message: error.message });
        }
        const message = error instanceof Error ? error.message : 'Falló la generación de SEO';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS9haS1zZW8vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFrQkEsb0JBb0NDO0FBckRELDZCQUF3QjtBQUN4QixzRUFBMEU7QUFFMUUsd0VBQStGO0FBQy9GLGdGQUFzRjtBQUN0RixvRkFBc0Y7QUFDdEYsd0VBQThFO0FBRTlFLE1BQU0sVUFBVSxHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDMUIsTUFBTSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0IsUUFBUSxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0NBQ3pDLENBQUMsQ0FBQztBQUVIOzs7R0FHRztBQUNJLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3BCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7SUFDL0YsQ0FBQztJQUNELE1BQU0sT0FBTyxHQUE2QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQ0FBbUIsQ0FBQyxDQUFDO0lBRWpGLElBQUksT0FBNEIsQ0FBQztJQUNqQyxJQUFJLENBQUM7UUFDSCxPQUFPLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUF3QixDQUFDO0lBQ2hHLENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRUQsSUFBSSxDQUFDO1FBQ0gsTUFBTSxXQUFXLEdBQW9CLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLHFDQUFtQixDQUFDLENBQUM7UUFDNUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDM0MsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFBLDhCQUFrQixFQUNsQztZQUNFLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztZQUNwQixNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNO1lBQzFCLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFDOUIsZUFBZSxFQUFFLElBQUEsOEJBQWdCLEVBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztTQUNyRCxFQUNELEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FDekIsQ0FBQztRQUNGLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUMxRCxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFlBQVksRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLEtBQUssWUFBWSxzQkFBYyxFQUFFLENBQUM7WUFDcEMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUNELE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDRCQUE0QixDQUFDO1FBQ3RGLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=