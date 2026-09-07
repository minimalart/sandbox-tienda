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
    target_locale: zod_1.z.string().min(2, 'target_locale es obligatorio'),
});
/**
 * POST /admin/landing-pages/:id/ai-translate
 * Traduce los textos al locale destino conservando estructura/links/handles.
 * Guarda el resultado sin tocar el `status`.
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
            return res.status(400).json({ message: 'La landing no tiene contenido para traducir.' });
        }
        const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
        const ai = await storeConfig.getAiConfig();
        const next = await (0, generator_1.translateLanding)({
            targetLocale: parsed.data.target_locale,
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
        const message = error instanceof Error ? error.message : 'Falló la traducción';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS9haS10cmFuc2xhdGUvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFrQkEsb0JBc0NDO0FBdkRELDZCQUF3QjtBQUN4QixzRUFBMEU7QUFFMUUsd0VBQStGO0FBQy9GLGdGQUFvRjtBQUNwRixvRkFBc0Y7QUFDdEYsd0VBQThFO0FBRTlFLE1BQU0sVUFBVSxHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDMUIsYUFBYSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLDhCQUE4QixDQUFDO0NBQ2pFLENBQUMsQ0FBQztBQUVIOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwQixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sSUFBSSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFDRCxNQUFNLE9BQU8sR0FBNkIsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsa0NBQW1CLENBQUMsQ0FBQztJQUVqRixJQUFJLE9BQTRCLENBQUM7SUFDakMsSUFBSSxDQUFDO1FBQ0gsT0FBTyxHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBd0IsQ0FBQztJQUNoRyxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVELElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFHLElBQUEsOEJBQWdCLEVBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3BELElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDakMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSw4Q0FBOEMsRUFBRSxDQUFDLENBQUM7UUFDM0YsQ0FBQztRQUNELE1BQU0sV0FBVyxHQUFvQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxxQ0FBbUIsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sRUFBRSxHQUFHLE1BQU0sV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzNDLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBQSw0QkFBZ0IsRUFDakM7WUFDRSxZQUFZLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhO1lBQ3ZDLGVBQWUsRUFBRSxPQUFPO1NBQ3pCLEVBQ0QsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixFQUFFLENBQzFELENBQUM7UUFDRixNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sWUFBWSxHQUFHLE1BQU0sT0FBTyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNuRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDOUUsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLEtBQUssWUFBWSxzQkFBYyxFQUFFLENBQUM7WUFDcEMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUNELE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDO1FBQy9FLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=