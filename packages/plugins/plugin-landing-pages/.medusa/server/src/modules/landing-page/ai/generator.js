"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLandingPuckData = generateLandingPuckData;
exports.improveLandingCopy = improveLandingCopy;
exports.translateLanding = translateLanding;
exports.generateLandingSeo = generateLandingSeo;
const zod_1 = require("zod");
const client_1 = require("./client");
const prompts_1 = require("./prompts");
const puck_schema_1 = require("./puck-schema");
const types_1 = require("./types");
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
/**
 * Llama al modelo, extrae JSON, lo valida contra PuckDataSchema y lo sanitiza.
 * Reintenta hasta `maxRetries` pidiendo corrección. Lanza LandingAiError si
 * nunca obtiene un puck_data utilizable.
 */
async function runPuckGeneration(messages, aiConfig) {
    const maxRetries = aiConfig?.maxRetries ?? (0, client_1.getAiConfig)().maxRetries;
    const model = aiConfig?.model;
    let lastError = 'respuesta no parseable';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const msgs = attempt === 0
            ? messages
            : [
                ...messages,
                {
                    role: 'user',
                    content: `El intento anterior falló (${lastError}). Devolvé SOLO el JSON válido con la forma pedida, sin texto extra.`,
                },
            ];
        const raw = await (0, client_1.callOpenRouter)(msgs, { model });
        const json = extractJson(raw);
        if (!json) {
            lastError = 'no se encontró JSON en la respuesta';
            continue;
        }
        const parsed = puck_schema_1.PuckDataSchema.safeParse(json);
        if (parsed.success) {
            return (0, puck_schema_1.sanitizePuckData)(parsed.data);
        }
        // Fallback tolerante: sanitizar igual; si quedó contenido válido, sirve.
        const sanitized = (0, puck_schema_1.sanitizePuckData)(json);
        if (sanitized.content.length > 0) {
            return sanitized;
        }
        lastError = parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')
            .slice(0, 300);
    }
    throw new types_1.LandingAiError(`La IA no devolvió un puck_data válido tras ${maxRetries + 1} intentos. ${lastError}`, 422);
}
function generateLandingPuckData(input, aiConfig) {
    if (!input.brief?.trim()) {
        throw new types_1.LandingAiError('El brief es obligatorio para generar una landing.', 400);
    }
    return runPuckGeneration((0, prompts_1.buildGenerateMessages)(input), aiConfig);
}
function improveLandingCopy(input, aiConfig) {
    if (!input.instruction?.trim()) {
        throw new types_1.LandingAiError('La instrucción es obligatoria.', 400);
    }
    return runPuckGeneration((0, prompts_1.buildImproveCopyMessages)(input), aiConfig);
}
function translateLanding(input, aiConfig) {
    if (!input.targetLocale?.trim()) {
        throw new types_1.LandingAiError('El locale destino es obligatorio.', 400);
    }
    return runPuckGeneration((0, prompts_1.buildTranslateMessages)(input), aiConfig);
}
const SeoSchema = zod_1.z
    .object({
    title: zod_1.z.string().optional().default(''),
    description: zod_1.z.string().optional().default(''),
    image: zod_1.z.string().optional().default(''),
    noindex: zod_1.z.boolean().optional().default(false),
})
    .strip();
const stripTags = (s) => s.replace(/<[^>]*>/g, '').trim();
async function generateLandingSeo(input, aiConfig) {
    const raw = await (0, client_1.callOpenRouter)((0, prompts_1.buildSeoMessages)(input), { model: aiConfig?.model });
    const json = extractJson(raw);
    const parsed = SeoSchema.safeParse(json ?? {});
    const data = parsed.success ? parsed.data : { title: '', description: '', image: '', noindex: false };
    return {
        title: stripTags(data.title).slice(0, 70),
        description: stripTags(data.description).slice(0, 180),
        image: /^(javascript|data|vbscript|file):/i.test(data.image) ? '' : data.image.trim().slice(0, 2000),
        noindex: Boolean(data.noindex),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbGFuZGluZy1wYWdlL2FpL2dlbmVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQXFHQSwwREFRQztBQUVELGdEQVFDO0FBRUQsNENBUUM7QUFhRCxnREFjQztBQTVKRCw2QkFBd0I7QUFDeEIscUNBQXlFO0FBQ3pFLHVDQUttQjtBQUNuQiwrQ0FBZ0Y7QUFDaEYsbUNBT2lCO0FBRWpCLGdGQUFnRjtBQUNoRixTQUFTLFdBQVcsQ0FBQyxHQUFXO0lBQzlCLElBQUksQ0FBQyxHQUFHO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDdEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ25CLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQztJQUN2RCxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDcEMsSUFBSSxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxXQUFXO0lBQ2IsQ0FBQztJQUNELE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0IsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEtBQUssRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQztZQUNILE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLEdBQUcsQ0FBQyxD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