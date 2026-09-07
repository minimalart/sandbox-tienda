"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBannerCopy = generateBannerCopy;
const zod_1 = require("zod");
const client_1 = require("../../../lib/landing-ai/client");
const types_1 = require("../../../lib/landing-ai/types");
const prompts_1 = require("./prompts");
/** Extrae el primer objeto JSON de una respuesta (tolerante a fences/ruido). */
function extractJson(raw) {
    if (!raw)
        return null;
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1])
        s = fence[1].trim();
    try {
        return JSON.parse(s);
    }
    catch {
        /* sigue */
    }
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) {
        try {
            return JSON.parse(s.slice(first, last + 1));
        }
        catch {
            /* noop */
        }
    }
    return null;
}
const BannerCopySchema = zod_1.z.object({
    content: zod_1.z
        .object({
        title: zod_1.z.string().optional(),
        subtitle: zod_1.z.string().optional(),
        body: zod_1.z.string().optional(),
    })
        .optional(),
    cta: zod_1.z
        .object({
        label: zod_1.z.string().optional(),
        url: zod_1.z.string().optional(),
    })
        .optional(),
});
const stripTags = (s) => s.replace(/<[^>]*>/g, '').trim();
/** Solo rutas relativas o http(s) seguros; bloquea esquemas peligrosos. */
const safeHref = (u) => (/^(javascript|data|vbscript|file):/i.test(u.trim()) ? '' : u.trim());
/**
 * Genera el copy de un banner (title/subtitle/body + CTA) con OpenRouter.
 * Reutiliza el cliente del módulo landing-page. Reintenta hasta `maxRetries`.
 */
async function generateBannerCopy(input, aiConfig) {
    if (!input.brief?.trim()) {
        throw new types_1.LandingAiError('El brief es obligatorio para generar el banner.', 400);
    }
    const maxRetries = aiConfig?.maxRetries ?? (0, client_1.getAiConfig)().maxRetries;
    const messages = (0, prompts_1.buildBannerCopyMessages)(input);
    let lastError = 'respuesta no parseable';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const msgs = attempt === 0
            ? messages
            : [
                ...messages,
                {
                    role: 'user',
                    content: `El intento anterior falló (${lastError}). Devolvé SOLO el JSON con la forma pedida, sin texto extra.`,
                },
            ];
        const raw = await (0, client_1.callOpenRouter)(msgs, { model: aiConfig?.model });
        const json = extractJson(raw);
        if (!json) {
            lastError = 'no se encontró JSON en la respuesta';
            continue;
        }
        const parsed = BannerCopySchema.safeParse(json);
        if (parsed.success) {
            const d = parsed.data;
            return {
                content: {
                    title: stripTags(d.content?.title ?? '').slice(0, 120),
                    subtitle: stripTags(d.content?.subtitle ?? '').slice(0, 180),
                    body: stripTags(d.content?.body ?? '').slice(0, 300),
                },
                cta: {
                    label: stripTags(d.cta?.label ?? '').slice(0, 40),
                    url: safeHref(d.cta?.url ?? '').slice(0, 2000),
                },
            };
        }
        lastError = parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')
            .slice(0, 300);
    }
    throw new types_1.LandingAiError(`La IA no devolvió un copy válido tras ${maxRetries + 1} intentos. ${lastError}`, 422);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYmFubmVyL2FpL2dlbmVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQTJEQSxnREFzREM7QUFqSEQsNkJBQXdCO0FBQ3hCLDJEQUE2RTtBQUM3RSx5REFBK0Q7QUFDL0QsdUNBQWtGO0FBRWxGLGdGQUFnRjtBQUNoRixTQUFTLFdBQVcsQ0FBQyxHQUFXO0lBQzlCLElBQUksQ0FBQyxHQUFHO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDdEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ25CLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQztJQUN2RCxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDcEMsSUFBSSxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxXQUFXO0lBQ2IsQ0FBQztJQUNELE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0IsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEtBQUssRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQztZQUNILE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsVUFBVTtR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