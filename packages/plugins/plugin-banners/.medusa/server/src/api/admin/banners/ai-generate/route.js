"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const zod_1 = require("zod");
const foreign_modules_1 = require("../../../../lib/foreign-modules");
const generator_1 = require("../../../../modules/banner/ai/generator");
const types_1 = require("../../../../lib/landing-ai/types");
const BodySchema = zod_1.z.object({
    brief: zod_1.z.string().min(1, 'El brief es obligatorio'),
    tone: zod_1.z.string().optional(),
    goal: zod_1.z.string().optional(),
    audience: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional(),
    placement: zod_1.z.string().optional(),
});
/**
 * POST /admin/banners/ai-generate
 * Genera el copy de un banner (title/subtitle/body + CTA) con IA. Stateless:
 * sirve para crear y editar (el banner puede no existir todavía). Devuelve el
 * copy para que el form lo aplique; no persiste nada.
 */
async function POST(req, res) {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
    }
    try {
        const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
        const ai = await storeConfig.getAiConfig();
        const result = await (0, generator_1.generateBannerCopy)(parsed.data, {
            model: ai.text_model,
            maxRetries: ai.text_max_retries,
        });
        return res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof types_1.LandingAiError) {
            return res.status(error.status).json({ message: error.message });
        }
        const message = error instanceof Error ? error.message : 'Falló la generación con IA';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jhbm5lcnMvYWktZ2VuZXJhdGUvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFxQkEsb0JBb0JDO0FBeENELDZCQUF3QjtBQUN4QixxRUFBNEY7QUFDNUYsdUVBQTZFO0FBQzdFLDREQUFrRTtBQUVsRSxNQUFNLFVBQVUsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzFCLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSx5QkFBeUIsQ0FBQztJQUNuRCxJQUFJLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMzQixJQUFJLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMzQixRQUFRLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMvQixNQUFNLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM3QixTQUFTLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNqQyxDQUFDLENBQUM7QUFFSDs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3BCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7SUFDL0YsQ0FBQztJQUNELElBQUksQ0FBQztRQUNILE1BQU0sV0FBVyxHQUFvQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxxQ0FBbUIsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sRUFBRSxHQUFHLE1BQU0sV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSw4QkFBa0IsRUFBQyxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQ25ELEtBQUssRUFBRSxFQUFFLENBQUMsVUFBVTtZQUNwQixVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQjtTQUNoQyxDQUFDLENBQUM7UUFDSCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsSUFBSSxLQUFLLFlBQVksc0JBQWMsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFDRCxNQUFNLE9BQU8sR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQztRQUN0RixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9