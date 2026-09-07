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
    brief: zod_1.z.string().min(1, 'El brief es obligatorio'),
    tone: zod_1.z.string().optional(),
    goal: zod_1.z.string().optional(),
    audience: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional(),
    campaign: zod_1.z.string().optional(),
    components: zod_1.z.array(zod_1.z.string()).optional(),
    productContext: zod_1.z.string().optional(),
    mode: zod_1.z.enum(['replace', 'append', 'draft_only']).default('replace'),
});
/**
 * POST /admin/landing-pages/:id/ai-generate
 * Genera puck_data con AI (OpenRouter). modes: replace | append | draft_only.
 * Nunca cambia el `status` (no publica automáticamente).
 */
async function POST(req, res) {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
    }
    const body = parsed.data;
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
        const aiOverrides = { model: ai.text_model, maxRetries: ai.text_max_retries };
        const current = (0, puck_schema_1.sanitizePuckData)(landing.puck_data);
        const generated = await (0, generator_1.generateLandingPuckData)({
            brief: body.brief,
            tone: body.tone,
            goal: body.goal,
            audience: body.audience,
            locale: body.locale,
            campaign: body.campaign,
            components: body.components,
            productContext: body.productContext,
            currentPuckData: body.mode === 'append' ? current : null,
        }, aiOverrides);
        let next = generated;
        if (body.mode === 'append') {
            next = (0, puck_schema_1.sanitizePuckData)({
                content: [...current.content, ...generated.content],
                root: current.root,
            });
        }
        let saved = false;
        if (body.mode !== 'draft_only') {
            await service.updateLandingPages({ id: landing.id, puck_data: next });
            saved = true;
        }
        const landing_page = saved
            ? await service.retrieveLandingPage(landing.id)
            : landing;
        return res.status(200).json({ landing_page, puck_data: next, saved });
    }
    catch (error) {
        if (error instanceof types_1.LandingAiError) {
            return res.status(error.status).json({ message: error.message });
        }
        const message = error instanceof Error ? error.message : 'Falló la generación AI';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS9haS1nZW5lcmF0ZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQTBCQSxvQkE4REM7QUF2RkQsNkJBQXdCO0FBQ3hCLHNFQUEwRTtBQUUxRSx3RUFBK0Y7QUFDL0YsZ0ZBQTJGO0FBQzNGLG9GQUFzRjtBQUN0Rix3RUFBNkY7QUFFN0YsTUFBTSxVQUFVLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUMxQixLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUseUJBQXlCLENBQUM7SUFDbkQsSUFBSSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDM0IsSUFBSSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDM0IsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0IsTUFBTSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0IsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0IsVUFBVSxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQzFDLGNBQWMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3JDLElBQUksRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7Q0FDckUsQ0FBQyxDQUFDO0FBRUg7Ozs7R0FJRztBQUNJLEtBQUssVUFBVSxJQUFJ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