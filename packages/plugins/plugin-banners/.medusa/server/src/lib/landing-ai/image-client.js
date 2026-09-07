"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImage = generateImage;
const settings_1 = require("./settings");
const types_1 = require("./types");
/**
 * Cliente de generación de IMÁGENES vía OpenRouter (compatible OpenAI), usando
 * por default el modelo "nano banana" (Google Gemini 2.5 Flash Image). A
 * diferencia del cliente de texto, manda `modalities: ['image','text']` y NO
 * `response_format` (rompería la salida de imagen). La imagen vuelve como data
 * URL base64 en `choices[0].message.images[0].image_url.url`.
 *
 * La API key (OPENROUTER_API_KEY) sigue siendo un SECRETO, pero ya no un secreto
 * de entorno: se edita en la card del Asistente IA, que es su dueña, y acá se lee
 * el mismo valor efectivo por `landing-page/settings.ts`. El modelo de imagen y
 * los demás parámetros siguen llegando desde store-config, resueltos en la route.
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';
const REQUEST_TIMEOUT_MS = 30_000;
async function generateImage(opts) {
    const { apiKey, siteUrl } = (0, settings_1.getLandingAiSettings)();
    if (!apiKey) {
        throw new types_1.LandingAiError('OPENROUTER_API_KEY no está configurada en el backend.', 503);
    }
    const model = opts.model?.trim() || DEFAULT_IMAGE_MODEL;
    // Con referencias, el `content` pasa de string a array multimodal (texto +
    // una parte image_url por cada foto). Sin referencias, se mantiene como string
    // para no cambiar el comportamiento de las landings.
    const refs = (opts.referenceImages ?? []).filter((u) => typeof u === 'string' && u.startsWith('data:'));
    const userContent = refs.length > 0
        ? [
            { type: 'text', text: opts.prompt },
            ...refs.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
        : opts.prompt;
    // Con referencias, componer suele tardar más: ampliamos el timeout.
    const timeoutMs = refs.length > 0 ? 60_000 : REQUEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
        res = await fetch(OPENROUTER_URL, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': siteUrl,
                'X-Title': 'Mercatto Landing Builder',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: userContent }],
                modalities: ['image', 'text'],
                image_config: {
                    aspect_ratio: opts.aspectRatio ?? '16:9',
                    image_size: opts.imageSize ?? '1K',
                },
            }),
        });
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new types_1.LandingAiError('Timeout generando la imagen con IA.', 504);
        }
        throw new types_1.LandingAiError(`No se pudo conectar con OpenRouter: ${err.message}`, 502);
    }
    finally {
        clearTimeout(timeout);
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new types_1.LandingAiError(`OpenRouter respondió ${res.status}: ${body.slice(0, 300)}`, 502);
    }
    const data = (await res.json().catch(() => null));
    const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl || typeof dataUrl !== 'string') {
        throw new types_1.LandingAiError('El modelo no devolvió ninguna imagen.', 502);
    }
    // data:image/png;base64,XXXX → mime + bytes
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
    const mimeType = match?.[1] ?? 'image/png';
    const b64 = match?.[2] ?? '';
    const bytes = Buffer.from(b64, 'base64');
    if (bytes.length === 0) {
        throw new types_1.LandingAiError('La imagen devuelta por el modelo está vacía.', 502);
    }
    return { bytes, mimeType };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9sYW5kaW5nLWFpL2ltYWdlLWNsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQTBCQSxzQ0ErRkM7QUF6SEQseUNBQWtEO0FBQ2xELG1DQUF5QztBQUV6Qzs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sY0FBYyxHQUFHLCtDQUErQyxDQUFDO0FBQ3ZFLE1BQU0sbUJBQW1CLEdBQUcsK0JBQStCLENBQUM7QUFDNUQsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLENBQUM7QUFTM0IsS0FBSyxVQUFVLGFBQWEsQ0FBQyxJQVluQztJQUNDLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBQSwrQkFBb0IsR0FBRSxDQUFDO0lBQ25ELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNaLE1BQU0sSUFBSSxzQkFBYyxDQUFDLHVEQUF1RCxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3pGLENBQUM7SUFDRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLG1CQUFtQixDQUFDO0lBRXhELDJFQUEyRTtJQUMzRSwrRUFBK0U7SUFDL0UscURBQXFEO0lBQ3JELE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGVBQWUsSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDeEcsTUFBTSxXQUFXLEdBQ2YsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDO1FBQ2IsQ0FBQyxDQUFDO1lBQ0UsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ25DLEdBQUcsSUFBSSxDQUFD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