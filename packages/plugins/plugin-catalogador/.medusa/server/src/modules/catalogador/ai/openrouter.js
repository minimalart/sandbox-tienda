"use strict";
/**
 * Cliente OpenRouter self-contained del Catalogador.
 *
 * Deliberadamente NO importa los clientes del Asistente IA ni de landing-page:
 * el PRD §23.1 exige que el Catalogador no quede acoplado al chat/agentes, y el
 * sistema de composición de extensiones penaliza depender de esas extensiones
 * enteras sólo para reusar un wrapper fino. Reutiliza la MISMA infra (OpenRouter,
 * `OPENROUTER_API_KEY`, nano-banana para imágenes) replicando un cliente mínimo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogadorAiError = void 0;
exports.isAiConfigured = isAiConfigured;
exports.emptyAiUsage = emptyAiUsage;
exports.mergeAiUsage = mergeAiUsage;
exports.createAiUsageScope = createAiUsageScope;
exports.getAiUsage = getAiUsage;
exports.chatComplete = chatComplete;
exports.generateImage = generateImage;
exports.extractJson = extractJson;
const node_async_hooks_1 = require("node:async_hooks");
/**
 * En el HOST este archivo integraba
 * `readForeignSetting('extension:ai-assistant', 'OPENROUTER_*')` para leer las
 * credenciales del namespace del Asistente IA (DB cifrada > env > default) y
 * permitir rotar la key desde su card sin tocar el entorno. El plugin no
 * tiene acceso a `app-settings/*` (viven en `apps/backend/src/modules/`),
 * asi que caemos a `process.env` directo — el mismo fallback que la version
 * host aplica cuando el snapshot todavia no cargo o el descriptor no existe.
 * Es exactamente el comportamiento pre-`app-settings`. Ver notas gemelas en
 * `settings.ts` y `plugin-landing-pages/src/modules/landing-page/settings.ts`.
 */
function readForeignSetting(_namespace, key) {
    const raw = process.env[key];
    return typeof raw === 'string' ? raw.trim() : '';
}
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 45_000;
class CatalogadorAiError extends Error {
    status;
    constructor(message, status = 500) {
        super(message);
        this.name = 'CatalogadorAiError';
        this.status = status;
    }
}
exports.CatalogadorAiError = CatalogadorAiError;
/**
 * La key sale del descriptor del Asistente IA, que es su DUEÑO, y sólo cae al
 * entorno si ese namespace no está instalado.
 *
 * Antes esto leía `process.env` directo, y el encabezado de `descriptors/catalogador.ts`
 * ya decía que la key "se gestiona en un namespace propio" — pero ese namespace no
 * existía. Ahora que existe y la card la deja rotar, seguir leyendo el entorno sería
 * peor que antes: el operador rota la key, el chat del asistente empieza a andar con
 * la nueva y el catalogador sigue con la vieja, tirando 503 sin que nada lo relacione
 * con lo que acaba de guardar.
 *
 * `readForeignSetting` busca por DATO (`findDescriptor`), no por import, así que un
 * proyecto generado sin el asistente degrada solo a `process.env`.
 */
const openRouterKey = () => readForeignSetting('extension:ai-assistant', 'OPENROUTER_API_KEY');
function isAiConfigured() {
    return Boolean(openRouterKey());
}
function apiKey() {
    const key = openRouterKey();
    if (!key)
        throw new CatalogadorAiError('OPENROUTER_API_KEY no está configurada.', 503);
    return key;
}
function headers() {
    const h = {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
    };
    // Misma dueña que la key: si se leyera del entorno, la atribucion del consumo en
    // el dashboard de OpenRouter apuntaria a una URL vieja despues de cambiarla.
    const site = readForeignSetting('extension:ai-assistant', 'OPENROUTER_SITE_URL');
    if (site) {
        h['HTTP-Referer'] = site;
        h['X-Title'] = 'Mercatto Catalogador';
    }
    return h;
}
function emptyAiUsage() {
    return {
        total_usd: 0,
        text_usd: 0,
        image_usd: 0,
        calls: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        by_model: {},
        missing_cost: false,
    };
}
/** Redondeo a 6 decimales: los costos por llamada son del orden de 1e-4 USD. */
function round6(n) {
    return Math.round(n * 1e6) / 1e6;
}
/** Suma dos acumulados (para agregar productos → ejecución). */
function mergeAiUsage(a, b) {
    const base = a ?? emptyAiUsage();
    const add = b ?? emptyAiUsage();
    const by_model = {};
    for (const [model, v] of [...Object.entries(base.by_model ?? {}), ...Object.entries(add.by_model ?? {})]) {
        const prev = by_model[model] ?? { calls: 0, usd: 0 };
        by_model[model] = { calls: prev.calls + v.calls, usd: round6(prev.usd + v.usd) };
    }
    return {
        total_usd: round6(base.total_usd + add.total_usd),
        text_usd: round6(base.text_usd + add.text_usd),
        image_usd: round6(base.image_usd + add.image_usd),
        calls: base.calls + add.calls,
        prompt_tokens: base.prompt_tokens + add.prompt_tokens,
        completion_tokens: base.completion_tokens + add.completion_tokens,
        by_model,
        missing_cost: Boolean(base.missing_cost || add.missing_cost),
    };
}
const usageStore = new node_async_hooks_1.AsyncLocalStorage();
/**
 * Abre un ámbito de medición: `usage` es el objeto que se va llenando con el
 * costo de TODAS las llamadas a OpenRouter que ocurran dentro de `run()`
 * (texto e imagen, a cualquier profundidad del pipeline).
 *
 * Se usa AsyncLocalStorage a propósito: el pipeline de imágenes encadena varias
 * funciones (recorte → fondo → composición) y hacer que cada una devuelva su
 * `usage` obligaría a cambiar toda la cadena de firmas.
 *
 * El llamador conserva la referencia a `usage`, así que también puede leer el
 * gasto cuando `run()` lanza: lo consumido antes del error ya se cobró.
 */
function createAiUsageScope() {
    const usage = emptyAiUsage();
    return { usage, run: (fn) => usageStore.run(usage, fn) };
}
/** Acumulado del tramo en curso (null fuera de `withAiUsageTracking`). */
function getAiUsage() {
    return usageStore.getStore() ?? null;
}
/** Imputa el consumo de una llamada al acumulado en curso (si hay uno). */
function recordUsage(kind, model, usage) {
    const acc = usageStore.getStore();
    if (!acc)
        return;
    const usd = typeof usage?.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : null;
    acc.calls += 1;
    acc.prompt_tokens += usage?.prompt_tokens ?? 0;
    acc.completion_tokens += usage?.completion_tokens ?? 0;
    if (usd === null) {
        acc.missing_cost = true;
    }
    else {
        acc.total_usd = round6(acc.total_usd + usd);
        if (kind === 'text')
            acc.text_usd = round6(acc.text_usd + usd);
        else
            acc.image_usd = round6(acc.image_usd + usd);
    }
    const prev = acc.by_model[model] ?? { calls: 0, usd: 0 };
    acc.by_model[model] = { calls: prev.calls + 1, usd: round6(prev.usd + (usd ?? 0)) };
}
async function postWithRetry(body, timeoutMs = DEFAULT_TIMEOUT_MS) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timer);
            // Reintentar sólo en 408/429/5xx
            if (res.status === 408 || res.status === 429 || res.status >= 500) {
                lastErr = new CatalogadorAiError(`OpenRouter respondió ${res.status}`, 502);
                await new Promise((r) => setTimeout(r, 400 * (attempt + 1) ** 2));
                continue;
            }
            return res;
        }
        catch (e) {
            clearTimeout(timer);
            lastErr = e;
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1) ** 2));
        }
    }
    throw lastErr instanceof Error ? lastErr : new CatalogadorAiError('OpenRouter no respondió.', 502);
}
/** Una vuelta de chat-completions (texto o visión). Devuelve texto + usage. */
async function chatComplete(opts) {
    const body = {
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : 1500,
    };
    if (typeof opts.temperature === 'number')
        body.temperature = opts.temperature;
    if (opts.reasoningEffort)
        body.reasoning = { effort: opts.reasoningEffort };
    if (opts.jsonMode)
        body.response_format = { type: 'json_object' };
    const res = await postWithRetry(body);
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new CatalogadorAiError(`OpenRouter ${res.status}: ${txt.slice(0, 300)}`, 502);
    }
    const data = (await res.json().catch(() => null));
    const choice = data?.choices?.[0];
    recordUsage('text', opts.model, data?.usage);
    return {
        content: choice?.message?.content ?? '',
        usage: data?.usage,
        finishReason: choice?.finish_reason ?? null,
    };
}
/**
 * Genera/recrea una imagen con un modelo multimodal (nano-banana / Gemini 2.5
 * Flash Image). `referenceImages` son data URLs que el modelo usa como base para
 * mantener fiel el producto (recreación/lifestyle).
 */
async function generateImage(opts) {
    const refs = (opts.referenceImages ?? []).filter((u) => typeof u === 'string' && u.startsWith('data:'));
    const userContent = refs.length > 0
        ? [
            { type: 'text', text: opts.prompt },
            ...refs.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
        : opts.prompt;
    const body = {
        model: opts.model,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: userContent }],
    };
    const res = await postWithRetry(body, refs.length > 0 ? 60_000 : DEFAULT_TIMEOUT_MS);
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new CatalogadorAiError(`OpenRouter (image) ${res.status}: ${txt.slice(0, 300)}`, 502);
    }
    const data = (await res.json().catch(() => null));
    // Se imputa antes de validar la imagen: una respuesta sin imagen igual se cobra.
    recordUsage('image', opts.model, data?.usage);
    const msg = data?.choices?.[0]?.message;
    let dataUrl = msg?.images?.[0]?.image_url?.url;
    if (!dataUrl && Array.isArray(msg?.content)) {
        const part = msg.content.find((p) => p?.type === 'image_url');
        dataUrl = part?.image_url?.url;
    }
    if (!dataUrl || !dataUrl.startsWith('data:')) {
        throw new CatalogadorAiError('El modelo no devolvió una imagen.', 502);
    }
    const parts = dataUrl.split(',', 2);
    const meta = parts[0] ?? '';
    const b64 = parts[1] ?? '';
    const mimeType = meta.slice(meta.indexOf(':') + 1, meta.indexOf(';')) || 'image/png';
    return { bytes: Buffer.from(b64, 'base64'), mimeType };
}
/**
 * Extrae un objeto JSON del texto del modelo, tolerando fences ```json y ruido.
 * Portado del tool original (robustez de parseo de salida IA).
 */
function extractJson(content) {
    if (!content)
        return null;
    let text = content.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1])
        text = fence[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start)
        return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnJvdXRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL2FpL29wZW5yb3V0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUFpREgsd0NBRUM7QUF3REQsb0NBV0M7QUFRRCxvQ0FrQkM7QUFnQkQsZ0RBTUM7QUFHRCxnQ0FFQztBQStERCxvQ0FpQ0M7QUFTRCxzQ0FvREM7QUFNRCxrQ0FhQztBQXpWRCx1REFBcUQ7QUFFckQ7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQVMsa0JBQWtCLENBQUMsVUFBa0IsRUFBRSxHQUFXO0lBQ3pELE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0IsT0FBTyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ25ELENBQUM7QUFFRCxNQUFNLGNBQWMsR0FBRywrQ0FBK0MsQ0FBQztBQUN2RSxNQUFNLGtCQUFrQixHQUFHLE1BQU0sQ0FBQztBQUVsQyxNQUFhLGtCQUFtQixTQUFRLEtBQUs7SUFDM0MsTUFBTSxDQUFTO0lBQ2YsWUFBWSxPQUFlLEVBQUUsTUFBTSxHQUFHLEdBQUc7UUFDdkMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxvQkFBb0IsQ0FBQztRQUNqQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0NBQ0Y7QUFQRCxnREFPQztBQUVEOzs7Ozs7Ozs7Ozs7O0dBYUc7QUFDSCxNQUFNLGFBQWEsR0FBRyxHQUFXLEVBQUUsQ0FDakMsa0JBQWtCLENBQUMsd0JBQXdCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztBQUVyRSxTQUFnQixjQUFjO0lBQzVCLE9BQU8sT0FBTyxD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