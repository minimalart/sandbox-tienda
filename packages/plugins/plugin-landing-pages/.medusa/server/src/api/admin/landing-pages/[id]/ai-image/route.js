"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const zod_1 = require("zod");
const landing_page_1 = require("../../../../../modules/landing-page");
const foreign_modules_1 = require("../../../../../lib/foreign-modules");
const puck_schema_1 = require("../../../../../modules/landing-page/ai/puck-schema");
const prompts_1 = require("../../../../../modules/landing-page/ai/prompts");
const image_client_1 = require("../../../../../modules/landing-page/ai/image-client");
const image_optimize_1 = require("../../../../../modules/landing-page/ai/image-optimize");
const types_1 = require("../../../../../modules/landing-page/ai/types");
const BodySchema = zod_1.z.object({
    blockId: zod_1.z.string().min(1, 'blockId es obligatorio'),
    styleHint: zod_1.z.string().max(500).optional(),
    aspectRatio: zod_1.z.enum(['16:9', '1:1', '4:3', '3:4', '9:16']).optional(),
    overwrite: zod_1.z.boolean().default(false),
});
/** Campo de imagen y kind según el tipo de bloque (o null si no aplica). */
const slotForBlock = (block) => {
    if (block.type === 'Hero')
        return { field: 'image', kind: 'hero' };
    if (block.type === 'ImageBlock')
        return { field: 'src', kind: 'imageBlock' };
    return null;
};
/** Busca un bloque por su props.id en content y en todas las zones. */
const findBlock = (puck, blockId) => {
    const lists = [puck.content ?? []];
    if (puck.zones && typeof puck.zones === 'object') {
        for (const arr of Object.values(puck.zones)) {
            if (Array.isArray(arr))
                lists.push(arr);
        }
    }
    for (const list of lists) {
        for (const block of list) {
            if (block?.props?.id === blockId)
                return block;
        }
    }
    return null;
};
const DEFAULT_ASPECT = {
    hero: '16:9',
    imageBlock: '4:3',
};
/**
 * POST /admin/landing-pages/:id/ai-image
 * Genera UNA imagen (nano banana vía OpenRouter) para un slot del puck_data,
 * la optimiza a WebP, la sube al File module y reemplaza la URL en el bloque.
 * Per-imagen a propósito (la UI itera los slots vacíos con progreso).
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
        const current = (0, puck_schema_1.sanitizePuckData)(landing.puck_data);
        const block = findBlock(current, body.blockId);
        if (!block) {
            return res.status(400).json({ message: 'El bloque indicado no existe en la landing.' });
        }
        const slot = slotForBlock(block);
        if (!slot) {
            return res.status(400).json({ message: 'El bloque indicado no admite imagen.' });
        }
        const props = block.props ?? (block.props = {});
        const existing = typeof props[slot.field] === 'string' ? props[slot.field] : '';
        // Idempotencia: no pisar una imagen ya seteada salvo overwrite explícito.
        if (existing.trim() && !body.overwrite) {
            return res.status(200).json({
                landing_page: landing,
                puck_data: current,
                block_id: body.blockId,
                image_url: existing,
                bytes: 0,
                skipped: true,
                saved: false,
            });
        }
        const storeConfig = req.scope.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
        const ai = await storeConfig.getAiConfig();
        const prompt = (0, prompts_1.buildImagePrompt)({
            kind: slot.kind,
            landingTitle: landing.title ?? '',
            slotTitle: typeof props.title === 'string' ? props.title : undefined,
            slotSubtitle: typeof props.subtitle === 'string' ? props.subtitle : undefined,
            alt: typeof props.alt === 'string' ? props.alt : undefined,
            caption: typeof props.caption === 'string' ? props.caption : undefined,
            styleHint: body.styleHint,
        });
        const generated = await (0, image_client_1.generateImage)({
            prompt,
            model: ai.image_model,
            aspectRatio: body.aspectRatio ?? DEFAULT_ASPECT[slot.kind],
        });
        const webp = await (0, image_optimize_1.optimizeToWebp)(generated.bytes, slot.kind, {
            quality: ai.image_quality,
            maxKb: ai.image_max_kb,
        });
        const fileModule = req.scope.resolve(utils_1.Modules.FILE);
        const [file] = await fileModule.createFiles([
            {
                filename: `landing-${landing.id}-${body.blockId}-${Date.now()}.webp`,
                mimeType: 'image/webp',
                content: webp.base64,
                // S3/DO Spaces exige ACL público explícito, si no el <img> recibe 403.
                access: 'public',
            },
        ]);
        if (!file?.url) {
            return res.status(500).json({ message: 'No se pudo guardar la imagen generada.' });
        }
        // Escribimos la URL https en el slot y re-sanitizamos (la URL https
        // sobrevive sanitizeHref; un data: se bloquearía, por eso subimos primero).
        props[slot.field] = file.url;
        const next = (0, puck_schema_1.sanitizePuckData)(current);
        await service.updateLandingPages({ id: landing.id, puck_data: next });
        const landing_page = await service.retrieveLandingPage(landing.id);
        return res.status(200).json({
            landing_page,
            puck_data: next,
            block_id: body.blockId,
            image_url: file.url,
            bytes: webp.bytes,
            skipped: false,
            saved: true,
        });
    }
    catch (error) {
        if (error instanceof types_1.LandingAiError) {
            return res.status(error.status).json({ message: error.message });
        }
        const message = error instanceof Error ? error.message : 'Falló la generación de imagen';
        return res.status(500).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS9haS1pbWFnZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWdFQSxvQkF1R0M7QUF0S0QscURBQW9EO0FBRXBELDZCQUF3QjtBQUN4QixzRUFBMEU7QUFFMUUsd0VBQStGO0FBQy9GLG9GQUFzRjtBQUN0Riw0RUFBa0Y7QUFDbEYsc0ZBRzZEO0FBQzdELDBGQUcrRDtBQUMvRCx3RUFBOEU7QUFFOUUsTUFBTSxVQUFVLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUMxQixPQUFPLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsd0JBQXdCLENBQUM7SUFDcEQsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ3pDLFdBQVcsRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ3JFLFNBQVMsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztDQUN0QyxDQUFDLENBQUM7QUFJSCw0RUFBNEU7QUFDNUUsTUFBTSxZQUFZLEdBQUcsQ0FDbkIsS0FBZSxFQUNvQyxFQUFFO0lBQ3JELElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNO1FBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO0lBQ25FLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxZQUFZO1FBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFF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