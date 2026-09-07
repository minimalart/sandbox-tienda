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
    instruction: zod_1.z.string().min(1, 'La instrucción es obligatoria'),
    locale: zod_1.z.string().optional(),
});
/**
 * POST /admin/landing-pages/:id/ai-improve-copy
 * Mejora sólo los textos, conservando estructura/orden/links. Guarda el
 * resultado sin tocar el `status`.
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
        const current = (0, puck_schema_1.sanitizePuckData)(landing.puck_data);
        if (current.content.length === 0) {
            return res.status(400).json({ message: 'La landing no tiene contenido para mejorar.' });
        }
        const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
        const ai = await storeConfig.getAiConfig();
        const next = await (0, generator_1.improveLandingCopy)({
            instruction: parsed.data.instruction,
            locale: parsed.data.locale,
            currentPuckData: current,
        }, { model: ai.text_model, maxRetries: ai.text_max_retries });
        await service.updateLandingPages({ id: landing.id, puck_data: next });
        const landing_page = await service.retrieveLandingPage(landing.id);
        return res.status(200).json({ landing_page, puck_data: next, saved: true });
    }
    catch (error) {
        if (error instanceof types_1.LandingAiError) {
            return res.status(error.status).json({ message: error.message });
        }
        const message = error instanceof Error ? error.message : 'Falló la mejora de copy';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS9haS1pbXByb3ZlLWNvcHkvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFtQkEsb0JBdUNDO0FBekRELDZCQUF3QjtBQUN4QixzRUFBMEU7QUFFMUUsd0VBQStGO0FBQy9GLGdGQUFzRjtBQUN0RixvRkFBc0Y7QUFDdEYsd0VBQThFO0FBRTlFLE1BQU0sVUFBVSxHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDMUIsV0FBVyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLCtCQUErQixDQUFDO0lBQy9ELE1BQU0sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQzlCLENBQUMsQ0FBQztBQUVIOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwQixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sSUFBSSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFDRCxNQUFNLE9BQU8sR0FBNkIsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsa0NBQW1CLENBQUMsQ0FBQztJQUVqRixJQUFJLE9BQTRCLENBQUM7SUFDakMsSUFBSSxDQUFDO1FBQ0gsT0FBTyxHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBd0IsQ0FBQztJQUNoRyxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVELElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFHLElBQUEsOEJBQWdCLEVBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3BELElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDakMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSw2Q0FBNkMsRUFBRSxDQUFDLENBQUM7UUFDMUYsQ0FBQztRQUNELE1BQU0sV0FBVyxHQUFvQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxxQ0FBbUIsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sRUFBRSxHQUFHLE1BQU0sV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzNDLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBQSw4QkFBa0IsRUFDbkM7WUFDRSxXQUFXLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXO1lBQ3BDLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU07WUFDMUIsZUFBZSxFQUFFLE9BQU87U0FDekIsRUFDRCxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsQ0FDMUQsQ0FBQztRQUNGLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDdEUsTUFBTSxZQUFZLEdBQUcsTUFBTSxPQUFPLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25FLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLElBQUksS0FBSyxZQUFZLHNCQUFjLEVBQUUsQ0FBQztZQUNwQyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBQ0QsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUM7UUFDbkYsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDM0MsQ0FBQztBQUNILENBQUMifQ==