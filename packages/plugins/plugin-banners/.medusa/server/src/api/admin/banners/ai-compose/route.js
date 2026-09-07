"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const zod_1 = require("zod");
const foreign_modules_1 = require("../../../../lib/foreign-modules");
const image_client_1 = require("../../../../lib/landing-ai/image-client");
const image_optimize_1 = require("../../../../lib/landing-ai/image-optimize");
const generator_1 = require("../../../../modules/banner/ai/generator");
const prompts_1 = require("../../../../modules/banner/ai/prompts");
const products_1 = require("../../../../modules/banner/ai/products");
const types_1 = require("../../../../lib/landing-ai/types");
const BodySchema = zod_1.z.object({
    brief: zod_1.z.string().min(1, 'El brief es obligatorio'),
    tone: zod_1.z.string().optional(),
    goal: zod_1.z.string().optional(),
    audience: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional(),
    placement: zod_1.z.string().optional(),
    styleHint: zod_1.z.string().max(500).optional(),
    aspectRatio: zod_1.z.enum(['21:9', '16:9', '1:1', '4:3', '3:4', '9:16']).optional(),
    productIds: zod_1.z.array(zod_1.z.string()).max(6).optional(),
});
const errMessage = (reason) => reason instanceof Error ? reason.message : String(reason);
/**
 * POST /admin/banners/ai-compose
 * Genera de una sola vez el "slide" completo de un banner: copy (title/subtitle/
 * body + CTA) e imagen. Cuando se eligen productos, sus datos alimentan el copy
 * y sus fotos se mandan como REFERENCIA al modelo de imagen (nano banana) para
 * que aparezcan en el banner sin deformarse.
 *
 * Es resiliente: copy e imagen se generan en paralelo con Promise.allSettled, así
 * que si una parte falla la otra igual vuelve (con un warning). Solo error duro
 * si fallan ambas. Stateless: el form aplica el resultado y persiste al guardar.
 */
async function POST(req, res) {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
    }
    const body = parsed.data;
    const productIds = body.productIds ?? [];
    try {
        const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
        const ai = await storeConfig.getAiConfig();
        // 1) Productos → contexto de copy + fotos de referencia (respetando el orden
        //    de selección para elegir un CTA determinístico).
        let products = [];
        if (productIds.length > 0) {
            const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
            const { data } = (await query.graph({
                entity: 'product',
                fields: ['id', 'title', 'description', 'handle', 'thumbnail', 'images.url'],
                filters: { id: productIds },
            }));
            const byId = new Map(data.map((p) => [p.id, p]));
            products = productIds.map((id) => byId.get(id)).filter((p) => !!p);
        }
        const copyProducts = products.map((p) => ({
            title: p.title ?? '',
            description: p.description ?? undefined,
        }));
        const productTitles = products.map((p) => p.title ?? '').filter(Boolean);
        const productHandles = products.map((p) => p.handle ?? '').filter(Boolean);
        const referenceUrls = products.map((p) => p.thumbnail || p.images?.[0]?.url || null);
        const referenceImages = await (0, products_1.toReferenceDataUrls)(referenceUrls, 4);
        // 2) Copy + imagen en paralelo (tolerante a fallos de una de las dos).
        const copyPromise = (0, generator_1.generateBannerCopy)({
            brief: body.brief,
            tone: body.tone,
            goal: body.goal,
            audience: body.audience,
            locale: body.locale,
            placement: body.placement,
            products: copyProducts,
        }, { model: ai.text_model, maxRetries: ai.text_max_retries });
        const imagePromise = (async () => {
            const prompt = (0, prompts_1.buildBannerImagePrompt)({
                brief: body.brief,
                styleHint: body.styleHint,
                productTitles,
                withProductRefs: referenceImages.length > 0,
            });
            const generated = await (0, image_client_1.generateImage)({
                prompt,
                model: ai.image_model,
                aspectRatio: body.aspectRatio ?? '16:9',
                referenceImages,
            });
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
                throw new types_1.LandingAiError('No se pudo guardar la imagen generada.', 500);
            }
            return { image_url: file.url, bytes: webp.bytes };
        })();
        const [copyR, imageR] = await Promise.allSettled([copyPromise, imagePromise]);
        // Si fallan las dos, es un error duro (devolvemos el status de la de copy).
        if (copyR.status === 'rejected' && imageR.status === 'rejected') {
            const primary = copyR.reason instanceof types_1.LandingAiError ? copyR.reason : imageR.reason;
            const status = primary instanceof types_1.LandingAiError ? primary.status : 500;
            return res.status(status).json({
                message: `${errMessage(copyR.reason)} | ${errMessage(imageR.reason)}`,
            });
        }
        const warnings = [];
        let content = { title: '', subtitle: '', body: '' };
        let cta = { label: '', url: '' };
        if (copyR.status === 'fulfilled') {
            content = copyR.value.content;
            cta = copyR.value.cta;
        }
        else {
            warnings.push(`copy: ${errMessage(copyR.reason)}`);
        }
        let image_url = '';
        let bytes = 0;
        if (imageR.status === 'fulfilled') {
            image_url = imageR.value.image_url;
            bytes = imageR.value.bytes;
        }
        else {
            warnings.push(`imagen: ${errMessage(imageR.reason)}`);
        }
        // Si el copy no propuso CTA y hay un producto elegido, apuntamos al primero.
        if (!cta.url && productHandles[0]) {
            cta = { label: cta.label || 'Ver producto', url: `/products/${productHandles[0]}` };
        }
        return res.status(200).json({ content, cta, image_url, bytes, product_ids: productIds, warnings });
    }
    catch (error) {
        if (error instanceof types_1.LandingAiError) {
            return res.status(error.status).json({ message: error.message });
        }
        const message = error instanceof Error ? error.message : 'Falló la generación con IA';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jhbm5lcnMvYWktY29tcG9zZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQStDQSxvQkE2SEM7QUEzS0QscURBQStFO0FBRS9FLDZCQUF3QjtBQUN4QixxRUFBNEY7QUFDNUYsMEVBQXdFO0FBQ3hFLDhFQUEyRTtBQUMzRSx1RUFBNkU7QUFDN0UsbUVBQStFO0FBQy9FLHFFQUE2RTtBQUM3RSw0REFBa0U7QUFFbEUsTUFBTSxVQUFVLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUMxQixLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUseUJBQXlCLENBQUM7SUFDbkQsSUFBSSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDM0IsSUFBSSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDM0IsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0IsTUFBTSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0IsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDaEMsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ3pDLFdBQVcsRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRTtJQUM3RSxVQUFVLEVBQUUsT0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFF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