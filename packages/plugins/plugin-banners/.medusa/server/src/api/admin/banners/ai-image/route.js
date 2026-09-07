"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const zod_1 = require("zod");
const foreign_modules_1 = require("../../../../lib/foreign-modules");
const image_client_1 = require("../../../../lib/landing-ai/image-client");
const image_optimize_1 = require("../../../../lib/landing-ai/image-optimize");
const prompts_1 = require("../../../../modules/banner/ai/prompts");
const types_1 = require("../../../../lib/landing-ai/types");
const BodySchema = zod_1.z.object({
    brief: zod_1.z.string().min(1, 'El brief es obligatorio'),
    title: zod_1.z.string().optional(),
    styleHint: zod_1.z.string().max(500).optional(),
    aspectRatio: zod_1.z.enum(['16:9', '1:1', '4:3', '3:4', '9:16']).optional(),
});
/**
 * POST /admin/banners/ai-image
 * Genera UNA imagen para un banner (nano banana vía OpenRouter), la optimiza a
 * WebP y la sube al File module (S3/DO Spaces). Stateless: devuelve la URL para
 * que el form la use en `media_url`. Reutiliza el pipeline de imágenes de
 * landing-page (generateImage + optimizeToWebp).
 */
async function POST(req, res) {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
    }
    const body = parsed.data;
    try {
        const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
        const ai = await storeConfig.getAiConfig();
        const prompt = (0, prompts_1.buildBannerImagePrompt)({
            brief: body.brief,
            title: body.title,
            styleHint: body.styleHint,
        });
        const generated = await (0, image_client_1.generateImage)({
            prompt,
            model: ai.image_model,
            aspectRatio: body.aspectRatio ?? '16:9',
        });
        // 'hero' = 1600px de ancho, ideal para un banner horizontal.
        const webp = await (0, image_optimize_1.optimizeToWebp)(generated.bytes, 'hero', {
            quality: ai.image_quality,
            maxKb: ai.image_max_kb,
        });
        const fileModule = req.scope.resolve(utils_1.Modules.FILE);
        const [file] = await fileModule.createFiles([
            {
                filename: `banner-ai-${Date.now()}.webp`,
                mimeType: 'image/webp',
                content: webp.base64,
                // S3/DO Spaces exige ACL público explícito o el <img> recibe 403.
                access: 'public',
            },
        ]);
        if (!file?.url) {
            return res.status(500).json({ message: 'No se pudo guardar la imagen generada.' });
        }
        return res.status(200).json({ image_url: file.url, bytes: webp.bytes });
    }
    catch (error) {
        if (error instanceof types_1.LandingAiError) {
            return res.status(error.status).json({ message: error.message });
        }
        const message = error instanceof Error ? error.message : 'Falló la generación de imagen';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jhbm5lcnMvYWktaW1hZ2Uvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF3QkEsb0JBa0RDO0FBekVELHFEQUFvRDtBQUVwRCw2QkFBd0I7QUFDeEIscUVBQTRGO0FBQzVGLDBFQUF3RTtBQUN4RSw4RUFBMkU7QUFDM0UsbUVBQStFO0FBQy9FLDREQUFrRTtBQUVsRSxNQUFNLFVBQVUsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzFCLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSx5QkFBeUIsQ0FBQztJQUNuRCxLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QixTQUFTLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDekMsV0FBVyxFQUFFLE9BQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7Q0FDdEUsQ0FBQyxDQUFDO0FBRUg7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLE1BQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxP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